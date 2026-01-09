// app/api/jobs/run-triage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  listAllGmailAccounts,
  getOAuthClientForAccount,
  gmailFromAuth,
  listRecentInboxMessages,
  getMessage,
  decodeBody,
  getHeader,
  ensureLabels,
  modifyMessageLabels,
  createDraftReply,
  getGmailSignature,
} from "@/lib/gmail";
import { analyzeEmail } from "@/lib/openai";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

const DEFAULT_LOOKBACK_DAYS = 14;

// Keep your own summaries out of triage
const SUMMARY_SUBJECT_MARKERS: string[] = [
  "AI Email Summary",
  "Inbox Summary",
  "AI Gmail Agent Summary",
];

type AgentRule = {
  id: string;
  gmail_account_id: string;
  rule_type: "skip_sender" | "skip_subject";
  pattern: string;
  is_enabled: boolean;
};

function extractEmailAddress(fromHeader: string): string {
  // e.g. "Name <email@domain.com>" => "email@domain.com"
  const m = fromHeader.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function shouldSkipBySummarySubject(subject: string) {
  const s = (subject || "").toLowerCase();
  return SUMMARY_SUBJECT_MARKERS.some((m) => s.includes(m.toLowerCase()));
}

function matchRules(params: {
  fromEmail: string;
  subject: string;
  rules: AgentRule[];
}): { skip: boolean; reason: string } {
  const from = params.fromEmail.toLowerCase();
  const subject = (params.subject || "").toLowerCase();

  const enabled = params.rules.filter((r) => r.is_enabled);

  // Skip sender: exact match on email address
  const senderRule = enabled.find(
    (r) => r.rule_type === "skip_sender" && r.pattern.trim().toLowerCase() === from
  );
  if (senderRule) {
    return { skip: true, reason: `Skipped (rule): sender "${from}"` };
  }

  // Skip subject: substring match (case-insensitive)
  const subjRule = enabled.find(
    (r) =>
      r.rule_type === "skip_subject" &&
      subject.includes(r.pattern.trim().toLowerCase())
  );
  if (subjRule) {
    return {
      skip: true,
      reason: `Skipped (rule): subject matched "${subjRule.pattern}"`,
    };
  }

  return { skip: false, reason: "" };
}

async function getRulesForAccount(gmailAccountId: string): Promise<AgentRule[]> {
  const { data, error } = await supabaseServer
    .from("agent_rules")
    .select("id,gmail_account_id,rule_type,pattern,is_enabled")
    .eq("gmail_account_id", gmailAccountId)
    .eq("is_enabled", true);

  if (error) {
    console.error("Failed loading agent rules", error);
    return [];
  }

  return (data || []) as AgentRule[];
}

async function alreadyProcessed(gmailAccountId: string, gmailMessageId: string) {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select("id")
    .eq("gmail_account_id", gmailAccountId)
    .eq("gmail_message_id", gmailMessageId)
    .limit(1);

  if (error) {
    // If query fails, be conservative and don’t create drafts
    console.error("Failed checking duplicates", error);
    return true;
  }

  return (data || []).length > 0;
}

export async function GET(req: NextRequest) {
  // Optional: allow manual runs without CRON_SECRET in local dev
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (CRON_SECRET && token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // lookbackDays param (defaults 14)
  const url = new URL(req.url);
  const lookbackDays =
    Number(url.searchParams.get("lookbackDays")) || DEFAULT_LOOKBACK_DAYS;

  try {
    const accounts = await listAllGmailAccounts();
    if (!accounts.length) {
      return NextResponse.json({ ok: true, accounts: 0, processed: 0 });
    }

    let processed = 0;
    let draftsCreated = 0;
    let skippedByRule = 0;
    let skippedDuplicate = 0;

    for (const account of accounts) {
      const { oauth2Client } = await getOAuthClientForAccount(account.id);
      const gmail = gmailFromAuth(oauth2Client);

      // Load rules once per account
      const rules = await getRulesForAccount(account.id);

      // Pull signature once per account (HTML signature)
      const signatureHtml = await getGmailSignature(oauth2Client);

      // Load messages
      const msgs = await listRecentInboxMessages(gmail, lookbackDays);

      if (!msgs.length) continue;

      // Ensure labels exist (optional)
      const labelNames = ["ai/triaged", "ai/draft_created", "ai/no_draft"];
      const nameToId = await ensureLabels(gmail, labelNames);

      for (const m of msgs) {
        if (!m.id) continue;

        // ✅ Hard duplicate prevention: if it’s already in email_logs, skip
        const dup = await alreadyProcessed(account.id, m.id);
        if (dup) {
          skippedDuplicate += 1;
          continue;
        }

        const full = await getMessage(gmail, m.id);
        const headers = full.payload?.headers || [];

        const subject = getHeader(headers, "Subject", "(no subject)");
        const fromHeader = getHeader(headers, "From", "");
        const fromEmail = extractEmailAddress(fromHeader);

        // ✅ Keep summary emails out of triage
        if (shouldSkipBySummarySubject(subject)) {
          // Still log as processed to prevent repeated scanning
          await supabaseServer.from("email_logs").insert({
            gmail_account_id: account.id,
            gmail_message_id: m.id,
            subject,
            from_address: fromHeader,
            summary: "Skipped: summary email (excluded from triage).",
            needs_response: false,
            priority: "low",
            draft_created: false,
          });
          continue;
        }

        // ✅ Apply rules
        const ruleResult = matchRules({ fromEmail, subject, rules });
        if (ruleResult.skip) {
          skippedByRule += 1;

          await supabaseServer.from("email_logs").insert({
            gmail_account_id: account.id,
            gmail_message_id: m.id,
            subject,
            from_address: fromHeader,
            summary: ruleResult.reason,
            needs_response: false,
            priority: "low",
            draft_created: false,
          });

          // Label it so Gmail reflects it
          const add = [nameToId["ai/triaged"], nameToId["ai/no_draft"]].filter(
            Boolean
          ) as string[];
          if (add.length) await modifyMessageLabels(gmail, m.id, add);

          processed += 1;
          continue;
        }

        // Analyze email with AI
        const body = decodeBody(full) || "";
        const triage = await analyzeEmail({
          from: fromHeader,
          to: account.email || "",
          subject,
          body,
        });

        // Apply labels in Gmail
        const proposed = (triage.proposed_labels || []).slice(0, 4);
        const labelNamesForEmail = ["ai/triaged", ...proposed];
        const labelMap = await ensureLabels(gmail, labelNamesForEmail);
        const labelIds = Object.values(labelMap);

        // Determine if we create a draft
        let draftCreated = false;

        // If AI says no response needed, no draft
        if (triage.needs_response && triage.draft_reply?.trim()) {
          // Append signature (HTML) — keep draft as plaintext + HTML signature block
          // NOTE: Gmail drafts support raw RFC822; simplest is to include signature HTML as-is at bottom.
          const replyText = triage.draft_reply;

          try {
            await createDraftReply(gmail, full, replyText, signatureHtml);
            draftCreated = true;
            draftsCreated += 1;
          } catch (e) {
            console.error("Failed creating draft", e);
            draftCreated = false;
          }
        }

        // Write log (this is what also prevents duplicates on next run)
        await supabaseServer.from("email_logs").insert({
          gmail_account_id: account.id,
          gmail_message_id: m.id,
          subject,
          from_address: fromHeader,
          summary: triage.summary || "",
          needs_response: !!triage.needs_response,
          priority: triage.priority || "normal",
          draft_created: draftCreated,
        });

        // Add Gmail labels
        const addLabels = [
          ...labelIds,
          draftCreated ? nameToId["ai/draft_created"] : nameToId["ai/no_draft"],
        ].filter(Boolean) as string[];

        if (addLabels.length) {
          try {
            await modifyMessageLabels(gmail, m.id, addLabels);
          } catch (e) {
            console.error("Failed modifying labels", e);
          }
        }

        processed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      lookbackDays,
      accounts: accounts.length,
      processed,
      draftsCreated,
      skippedByRule,
      skippedDuplicate,
    });
  } catch (err) {
    console.error("Error running triage job", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}