// app/api/jobs/run-triage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";
import {
  getOAuthClientForAccount,
  gmailFromAuth,
  listRecentInboxMessages,
  getMessage,
  ensureLabels,
  modifyMessageLabels,
  createDraftReply,
  decodeBody,
  getHeader,
  getGmailSignature,
  sendEmail,
} from "../../../../lib/gmail";
import { analyzeEmail } from "../../../../lib/openai";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// Summary recipient: env wins, otherwise default
const SUMMARY_RECIPIENT =
  process.env.SUMMARY_RECIPIENT || "support@drzelisko.com";

// Review last 14 days only
const LOOKBACK_DAYS = 14;

// Labels
const LABELS = {
  NEEDS_REPLY: "AI/NeedsReply",
  NO_REPLY: "AI/NoReply",
  WAITING_USER: "AI/WaitingUser",
  SKIPPED_RULE: "AI/SkippedByRule",
  PROCESSED: "AI/Processed",
  NO_DRAFT_RULE: "AI/NoDraftRule",
};

type TriageRule = {
  id: string;
  gmail_account_id: string;
  rule_type: "from" | "subject_contains";
  pattern: string;
  action: "skip" | "no_draft";
  is_active: boolean;
};

type RunEntry = {
  subject: string;
  from_address: string;
  priority: string;
  needs_response: boolean;
  draft_created: boolean;
  summary: string;
  note?: string;
};

function matchesRule(rule: TriageRule, fromAddr: string, subject: string) {
  const pattern = rule.pattern.toLowerCase();
  const fromLower = (fromAddr || "").toLowerCase();
  const subjectLower = (subject || "").toLowerCase();
  if (rule.rule_type === "from") return fromLower.includes(pattern);
  return subjectLower.includes(pattern);
}

function findRule(rules: TriageRule[], fromAddr: string, subject: string) {
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (matchesRule(rule, fromAddr, subject)) return rule;
  }
  return null;
}

async function getAlreadyProcessedMessageIds(gmailAccountId: string) {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select("gmail_message_id")
    .eq("gmail_account_id", gmailAccountId)
    .limit(5000);

  if (error) {
    console.error("Error fetching processed ids", error);
    return new Set<string>();
  }

  const ids = new Set<string>();
  for (const row of data || []) {
    if (row.gmail_message_id) ids.add(row.gmail_message_id);
  }
  return ids;
}

function buildSummaryBody(accountEmail: string, entries: RunEntry[]) {
  const total = entries.length;
  const drafts = entries.filter((e) => e.draft_created).length;
  const high = entries.filter((e) => e.priority === "high").length;
  const needs = entries.filter((e) => e.needs_response).length;

  const lines: string[] = [];
  lines.push("Dear Support Team,");
  lines.push("");
  lines.push(
    "Here is a brief summary of your AI email assistant’s activity for the most recent triage run."
  );
  lines.push("");
  lines.push(`Account processed: ${accountEmail}`);
  lines.push("");
  lines.push("High-level overview:");
  lines.push("");
  lines.push(`* Total emails reviewed: ${total}`);
  lines.push(`* Emails needing a response: ${needs}`);
  lines.push(`* Drafts created: ${drafts}`);
  lines.push(`* High-priority emails: ${high}`);
  lines.push("");
  lines.push("Details:");
  lines.push("");
  lines.push("------------------------------------------------------------");
  lines.push("");

  entries.forEach((e, idx) => {
    lines.push(`Email ${idx + 1}:`);
    lines.push(`  Subject: ${e.subject || "(no subject)"}`);
    lines.push(`  From: ${e.from_address || "(unknown sender)"}`);
    lines.push(`  Priority: ${e.priority || "normal"}`);
    lines.push(`  Needs Response: ${e.needs_response ? "Yes" : "No"}`);
    lines.push(`  Draft Status: ${e.draft_created ? "Draft created" : "No draft"}`);
    if (e.note) lines.push(`  Note: ${e.note}`);
    lines.push("  Summary:");
    lines.push(`    ${e.summary || "(no summary provided)"}`);
    lines.push("");
    lines.push("------------------------------------------------------------");
    lines.push("");
  });

  lines.push("Next steps:");
  lines.push("");
  lines.push("* Review any drafts in Gmail → Drafts.");
  lines.push("* Edit as needed, then approve/send.");
  lines.push("");
  lines.push("All the best,");
  lines.push("Your AI Gmail Assistant");

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: accounts, error: accountsError } = await supabaseServer
      .from("gmail_accounts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ ok: true, accounts: 0, processed: 0 });
    }

    let processedCount = 0;

    for (const account of accounts) {
      const { oauth2Client } = await getOAuthClientForAccount(account.id);
      const gmail = gmailFromAuth(oauth2Client);

      const signatureHtml = await getGmailSignature(oauth2Client);

      const labelMap = await ensureLabels(gmail, Object.values(LABELS));
      const processedLabelId = labelMap[LABELS.PROCESSED];

      const processedIds = await getAlreadyProcessedMessageIds(account.id);

      const { data: rules, error: rulesError } = await supabaseServer
        .from("triage_rules")
        .select("id, gmail_account_id, rule_type, pattern, action, is_active")
        .eq("gmail_account_id", account.id)
        .eq("is_active", true);

      if (rulesError) console.error("Error loading triage_rules", rulesError);
      const activeRules: TriageRule[] = (rules || []) as TriageRule[];

      const msgs = await listRecentInboxMessages(gmail, LOOKBACK_DAYS);

      const runEntries: RunEntry[] = [];

      for (const msgMeta of msgs || []) {
        const msgId = msgMeta.id;
        if (!msgId) continue;

        // DEDUPE: if already processed, skip (prevents multiple drafts)
        if (processedIds.has(msgId)) continue;

        const msg = await getMessage(gmail, msgId);
        const headers = msg.payload?.headers ?? [];

        const subject = getHeader(headers, "Subject", "(no subject)");
        const fromAddr = getHeader(headers, "From", "");
        const toAddr = getHeader(headers, "To", "");
        const body = decodeBody(msg);

        const labelsToAdd: string[] = [];
        if (processedLabelId) labelsToAdd.push(processedLabelId);

        const matchedRule = findRule(activeRules, fromAddr, subject);

        // If rule action is SKIP: do not AI triage, do not draft.
        if (matchedRule && matchedRule.action === "skip") {
          const skippedLabelId = labelMap[LABELS.SKIPPED_RULE];
          if (skippedLabelId) labelsToAdd.push(skippedLabelId);

          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);

          await modifyMessageLabels(gmail, msgId, labelsToAdd);

          const summaryText = `Skipped automatically due to rule (${matchedRule.rule_type} contains "${matchedRule.pattern}").`;

          await supabaseServer
            .from("email_logs")
            .upsert(
              {
                gmail_account_id: account.id,
                gmail_message_id: msgId,
                subject,
                from_address: fromAddr,
                summary: summaryText,
                needs_response: false,
                priority: "low",
                draft_created: false,
              },
              { onConflict: "gmail_account_id,gmail_message_id" }
            );

          processedIds.add(msgId);
          processedCount += 1;

          runEntries.push({
            subject,
            from_address: fromAddr,
            priority: "low",
            needs_response: false,
            draft_created: false,
            summary: summaryText,
            note: "Skipped by rule",
          });

          continue;
        }

        // AI triage
        let triage;
        try {
          triage = await analyzeEmail({
            from: fromAddr,
            to: toAddr,
            subject,
            body,
          });
        } catch (err) {
          console.error("AI triage error", err);

          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);

          await modifyMessageLabels(gmail, msgId, labelsToAdd);

          const summaryText =
            "Skipped by AI agent due to AI error (e.g., rate limit or parsing issue).";

          await supabaseServer
            .from("email_logs")
            .upsert(
              {
                gmail_account_id: account.id,
                gmail_message_id: msgId,
                subject,
                from_address: fromAddr,
                summary: summaryText,
                needs_response: false,
                priority: "normal",
                draft_created: false,
              },
              { onConflict: "gmail_account_id,gmail_message_id" }
            );

          processedIds.add(msgId);
          processedCount += 1;

          runEntries.push({
            subject,
            from_address: fromAddr,
            priority: "normal",
            needs_response: false,
            draft_created: false,
            summary: summaryText,
            note: "AI error",
          });

          continue;
        }

        // Apply needs reply / no reply labels
        if (triage.needs_response) {
          const needsReplyLabelId = labelMap[LABELS.NEEDS_REPLY];
          if (needsReplyLabelId) labelsToAdd.push(needsReplyLabelId);
        } else {
          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);
        }

        // If matched rule action is NO_DRAFT: allow triage + labels, but do not create draft
        const noDraft =
          matchedRule && matchedRule.action === "no_draft" ? true : false;

        let draftCreated = false;

        if (noDraft) {
          const noDraftLabelId = labelMap[LABELS.NO_DRAFT_RULE];
          if (noDraftLabelId) labelsToAdd.push(noDraftLabelId);
        }

        if (!noDraft && triage.needs_response && triage.draft_reply?.trim()) {
          await createDraftReply(gmail, msg, triage.draft_reply.trim(), signatureHtml);
          draftCreated = true;

          const waitingUserLabelId = labelMap[LABELS.WAITING_USER];
          if (waitingUserLabelId) labelsToAdd.push(waitingUserLabelId);
        }

        await modifyMessageLabels(gmail, msgId, labelsToAdd);

        await supabaseServer
          .from("email_logs")
          .upsert(
            {
              gmail_account_id: account.id,
              gmail_message_id: msgId,
              subject,
              from_address: fromAddr,
              summary: triage.summary || "",
              needs_response: !!triage.needs_response,
              priority: triage.priority || "normal",
              draft_created: draftCreated,
            },
            { onConflict: "gmail_account_id,gmail_message_id" }
          );

        processedIds.add(msgId);
        processedCount += 1;

        runEntries.push({
          subject,
          from_address: fromAddr,
          priority: triage.priority || "normal",
          needs_response: !!triage.needs_response,
          draft_created: draftCreated,
          summary: triage.summary || "",
          note: noDraft ? "Draft prevented by rule" : undefined,
        });
      }

      // Auto-send summary email for this run (per account)
      if (runEntries.length > 0) {
        const summaryBody = buildSummaryBody(account.email, runEntries);
        try {
          await sendEmail(
            gmail,
            SUMMARY_RECIPIENT,
            "AI inbox summary – latest triage run",
            summaryBody
          );
        } catch (err) {
          console.error("Error sending summary email", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      processed: processedCount,
      lookbackDays: LOOKBACK_DAYS,
    });
  } catch (err) {
    console.error("Error running triage job", err);
    return NextResponse.json(
      { error: "Internal error running triage job" },
      { status: 500 }
    );
  }
}

