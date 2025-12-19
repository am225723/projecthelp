// app/api/jobs/send-summaries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getOAuthClientForAccount, gmailFromAuth, sendEmail } from "@/lib/gmail";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// Who receives summary emails (optional). If not set, summary goes to each connected inbox email.
const SUMMARY_TO = process.env.SUMMARY_TO || "";

// Look back 24 hours for the summary window
const LOOKBACK_HOURS = 24;

// Subject used for summary emails (we’ll exclude these from activity)
const SUMMARY_SUBJECT = "AI Email Summary (Drafts Created)";

// Filter out any activity rows that are themselves the summary email (avoid feedback loops)
function isSummaryEmailLog(log: any) {
  const subject = String(log?.subject || "").toLowerCase();
  return subject.includes("ai email summary");
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
      .select("id,email");

    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ ok: true, accounts: 0, summaries_sent: 0 });
    }

    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    let summariesSent = 0;

    for (const account of accounts) {
      const { data: logs, error: logsError } = await supabaseServer
        .from("email_logs")
        .select("created_at, subject, from_address, summary, draft_created")
        .eq("gmail_account_id", account.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });

      if (logsError) {
        console.error(`Error fetching logs for account ${account.id}:`, logsError);
        continue;
      }

      if (!logs || logs.length === 0) continue;

      // Remove any summary emails from the logs (prevents showing summaries in summaries)
      const filteredLogs = logs.filter((l) => !isSummaryEmailLog(l));

      if (filteredLogs.length === 0) continue;

      // ✅ Only send summary if at least one draft was created
      const drafts = filteredLogs.filter((l) => l.draft_created === true);
      if (drafts.length === 0) continue;

      const to = SUMMARY_TO || account.email || "";
      if (!to) continue;

      // Build a concise, professional, structured summary (no labels)
      const lines: string[] = [];

      lines.push("Dear Team,");
      lines.push("");
      lines.push(
        "Thank you for taking a moment to review the inbox activity. Below is a summary of messages that resulted in a draft reply being created."
      );
      lines.push(
        `This summary covers approximately the last ${LOOKBACK_HOURS} hours (since ${since.toLocaleString()}).`
      );
      lines.push("");
      lines.push("------------------------------------------------------------");
      lines.push("");

      drafts.forEach((log, idx) => {
        const n = idx + 1;
        const subject = log.subject || "(no subject)";
        const from = log.from_address || "(unknown sender)";
        const summary = log.summary || "(no summary provided)";

        lines.push(`Email ${n}:`);
        lines.push(`  Subject: ${subject}`);
        lines.push(`  From: ${from}`);
        lines.push("  Summary:");
        lines.push(`    ${summary}`);
        lines.push("");
        lines.push("------------------------------------------------------------");
        lines.push("");
      });

      lines.push("Next steps (when you have a moment):");
      lines.push("");
      lines.push("* Please review the drafts in Gmail → Drafts.");
      lines.push("* Edit as needed, then approve and send.");
      lines.push("");
      lines.push("All the best,");
      lines.push("Your AI Gmail Assistant");

      const body = lines.join("\n");

      const { oauth2Client } = await getOAuthClientForAccount(account.id);
      const gmail = gmailFromAuth(oauth2Client);

      try {
        await sendEmail(gmail, to, SUMMARY_SUBJECT, body);
        summariesSent += 1;
      } catch (err) {
        console.error(`Error sending summary email for account ${account.id}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      summaries_sent: summariesSent,
    });
  } catch (err) {
    console.error("Error running send-summaries job", err);
    return NextResponse.json(
      { error: "Internal error running send-summaries job" },
      { status: 500 }
    );
  }
}