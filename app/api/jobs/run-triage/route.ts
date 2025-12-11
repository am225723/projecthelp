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
} from "../../../../lib/gmail";
import { analyzeEmail } from "../../../../lib/openai";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// Look back 14 days so we cover everything since 12/1
const LOOKBACK_DAYS = 14;

// Labels we'll ensure exist in Gmail
const LABELS = {
  NEEDS_REPLY: "AI/NeedsReply",
  NO_REPLY: "AI/NoReply",
  WAITING_USER: "AI/WaitingUser",
};

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
      .select("*");

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ ok: true, accounts: 0, processed: 0 });
    }

    let processedCount = 0;

    for (const account of accounts) {
      const { oauth2Client } = await getOAuthClientForAccount(account.id);
      const gmail = gmailFromAuth(oauth2Client);

      // Fetch the user's real Gmail signature once per account
      const signature = await getGmailSignature(oauth2Client);

      // Ensure the labels we use exist
      const labelMap = await ensureLabels(gmail, Object.values(LABELS));

      // Get all recent messages (last 14 days)
      const msgs = await listRecentInboxMessages(gmail, LOOKBACK_DAYS);

      for (const msgMeta of msgs || []) {
        const msgId = msgMeta.id;
        if (!msgId) continue;

        const msg = await getMessage(gmail, msgId);
        const headers = msg.payload?.headers ?? [];

        const subject = getHeader(headers, "Subject", "(no subject)");
        const fromAddr = getHeader(headers, "From", "");
        const toAddr = getHeader(headers, "To", "");
        const body = decodeBody(msg);

        // Call Perplexity Sonar to analyze the email
        let triage;
        try {
          triage = await analyzeEmail({
            from: fromAddr,
            to: toAddr,
            subject,
            body,
          });
        } catch (err) {
          console.error("Error calling Perplexity for triage", err);

          // Log that we skipped this email due to AI error
          await supabaseServer.from("email_logs").insert({
            gmail_account_id: account.id,
            gmail_message_id: msgId,
            subject,
            from_address: fromAddr,
            summary:
              "Skipped by AI agent due to AI error (e.g., rate limit or parsing issue).",
            needs_response: false,
            priority: "normal",
            draft_created: false,
          });

          // Skip to next message
          continue;
        }

        const labelsToAdd: string[] = [];

        if (triage.needs_response) {
          const needsReplyLabelId = labelMap[LABELS.NEEDS_REPLY];
          if (needsReplyLabelId) labelsToAdd.push(needsReplyLabelId);
        } else {
          const noReplyLabelId = labelMap[LABELS.NO_REPLY];
          if (noReplyLabelId) labelsToAdd.push(noReplyLabelId);
        }

        let draftCreated = false;

        if (triage.needs_response && triage.draft_reply.trim()) {
          const replyBody = triage.draft_reply.trim();

          // Append the real Gmail signature if we have one
          const replyWithSignature = signature
            ? `${replyBody}\n\n${signature}`
            : replyBody;

          await createDraftReply(gmail, msg, replyWithSignature);
          draftCreated = true;

          const waitingUserLabelId = labelMap[LABELS.WAITING_USER];
          if (waitingUserLabelId) labelsToAdd.push(waitingUserLabelId);
        }

        if (labelsToAdd.length > 0) {
          await modifyMessageLabels(gmail, msgId, labelsToAdd);
        }

        // Log the triage result in Supabase
        await supabaseServer.from("email_logs").insert({
          gmail_account_id: account.id,
          gmail_message_id: msgId,
          subject,
          from_address: fromAddr,
          summary: triage.summary,
          needs_response: triage.needs_response,
          priority: triage.priority,
          draft_created: draftCreated,
        });

        processedCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      processed: processedCount,
    });
  } catch (err) {
    console.error("Error running triage job", err);
    return NextResponse.json(
      { error: "Internal error running triage job" },
      { status: 500 }
    );
  }
}