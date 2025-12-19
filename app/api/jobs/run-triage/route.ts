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
const SUMMARY_RECIPIENT =
  process.env.SUMMARY_RECIPIENT || "support@drzelisko.com";

// Only review last 14 days
const LOOKBACK_DAYS = 14;

// Gmail labels we use internally (NOT shown in summary email)
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
  const needs = entries.filter((e) => e.needs_response).length;
  const high = entries.filter((e) => (e.priority || "normal") === "high").length;

  const lines: string[] = [];
  lines.push("Dear Support Team,");
  lines.push("");
  lines.push(
    "Here is a brief summary of the emails that were triaged during the most recent run."
  );
  lines.push("");
  lines.push(`Inbox: ${accountEmail}`);
  lines.push("");
  lines.push("Overview:");
  lines.push("");
  lines.push(`* Emails reviewed: ${total}`);
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
    lines.push(`  Priority: ${(e.priority || "normal").toLowerCase()}`);
    lines.push(`  Needs Response: ${e.needs_response ? "Yes" : "No"}`);
    lines.push(`  Draft Created: ${e.draft_created ? "Yes" : "No"}`);
    lines.push("  Summary:");
    lines.push(`    ${e.summary || "(no summary provided)"}`);
    lines.push("");
    lines.push("------------------------------------------------------------");
    lines.push("");
  });

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

      // Ensure labels exist in Gmail (internal use only)
      const labelMap = await ensureLabels(gmail, Object.values(LABELS));
      const processedLabelId = labelMap[LABELS.PROCESSED];

      // DB-backed dedupe: do not process the same email twice
      const processedIds = await getAlreadyProcessedMessageIds(account.id);

      // Load active rules (skip / no_draft)
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

        // DEDUPE
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

        // Rule: SKIP completely
        if (matchedRule && matchedRule.action === "skip") {
          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);

          const skippedLabelId = labelMap[LABELS.SKIPPED_RULE];
          if (skippedLabelId) labelsToAdd.push(skippedLabelId);

          await modifyMessageLabels(gmail, msgId, labelsToAdd);

          const summaryText =
            "This email was skipped due to an inbox rule.";

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
          });
          continue;
        }

        // AI triage
        let triage;
        try {
          triage = await analyzeEmail({ from: fromAddr, to: toAddr, subject, body });
        } catch (err) {
          console.error("AI triage error", err);

          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);

          await modifyMessageLabels(gmail, msgId, labelsToAdd);

          const summaryText =
            "This email could not be triaged due to an AI error (for example, rate limits).";

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
          });
          continue;
        }

        // Labels: needs reply vs no reply
        if (triage.needs_response) {
          const needsReplyLabelId = labelMap[LABELS.NEEDS_REPLY];
          if (needsReplyLabelId) labelsToAdd.push(needsReplyLabelId);
        } else {
          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);
        }

        // Rule: NO_DRAFT (triage ok, but don't draft)
        const noDraft = matchedRule?.action === "no_draft";
        if (noDraft) {
          const noDraftLabelId = labelMap[LABELS.NO_DRAFT_RULE];
          if (noDraftLabelId) labelsToAdd.push(noDraftLabelId);
        }

        let draftCreated = false;
        if (!noDraft && triage.needs_response && triage.draft_reply?.trim()) {
          await createDraftReply(
            gmail,
            msg,
            triage.draft_reply.trim(),
            signatureHtml
          );
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
        });
      }

      // ✅ Only send summary if drafts were created in this run (per account)
      const createdDrafts = runEntries.filter((e) => e.draft_created).length;
      if (runEntries.length > 0 && createdDrafts > 0) {
        const summaryBody = buildSummaryBody(account.email, runEntries);
        try {
          await sendEmail(
            gmail,
            SUMMARY_RECIPIENT,
            "AI inbox summary – drafts created",
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
      summaryRecipient: SUMMARY_RECIPIENT,
    });
  } catch (err) {
    console.error("Error running triage job", err);
    return NextResponse.json(
      { error: "Internal error running triage job" },
      { status: 500 }
    );
  }
}