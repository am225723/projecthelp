// app/api/jobs/send-summaries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";
import {
  getOAuthClientForAccount,
  gmailFromAuth,
  sendEmail,
} from "../../../../lib/gmail";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// Look back 24 hours for the summary window
const LOOKBACK_HOURS = 24;

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
      return NextResponse.json({ ok: true, accounts: 0, summaries_sent: 0 });
    }

    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    let summariesSent = 0;

    for (const account of accounts) {
      // Fetch logs for this account in the last window
      const { data: logs, error: logsError } = await supabaseServer
        .from("email_logs")
        .select("*")
        .eq("gmail_account_id", account.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });

      if (logsError) {
        console.error(
          `Error fetching logs for account ${account.id}:`,
          logsError
        );
        continue;
      }

      if (!logs || logs.length === 0) {
        // Nothing to summarize for this account
        continue;
      }

      // Build a warm, structured summary email in your style
      const timeframeLine = `This summary covers approximately the last ${LOOKBACK_HOURS} hours.`;

      const lines: string[] = [];

      lines.push(`Dear ${account.email},`);
      lines.push("");
      lines.push(
        "Thank you for taking a moment to review your AI email assistant's activity."
      );
      lines.push(timeframeLine);
      lines.push("");
      lines.push(
        "Below is a summary of the emails that were reviewed, along with the actions the assistant took or suggested. Please look over the details and adjust or approve any drafts directly in your Gmail account."
      );
      lines.push("");
      lines.push("------------------------------------------------------------");
      lines.push("");

      logs.forEach((log, idx) => {
        const index = idx + 1;
        const subject = log.subject || "(no subject)";
        const from = log.from_address || "(unknown sender)";
        const priority = log.priority || "normal";
        const needsResponse = log.needs_response ? "Yes" : "No";
        const draftStatus = log.draft_created ? "Draft created" : "No draft";
        const summary = log.summary || "(no summary provided)";

        lines.push(`Email ${index}:`);
        lines.push(`  Subject: ${subject}`);
        lines.push(`  From: ${from}`);
        lines.push(`  Priority: ${priority}`);
        lines.push(`  Needs Response: ${needsResponse}`);
        lines.push(`  Draft Status: ${draftStatus}`);
        lines.push("  Summary:");
        lines.push(`    ${summary}`);
        lines.push("");
        lines.push("------------------------------------------------------------");
        lines.push("");
      });

      lines.push(
        "Next steps for you (when you have a moment):"
      );
      lines.push("");
      lines.push(
        "* Review any drafts that were created in your Gmail Drafts folder."
      );
      lines.push(
        "* Edit, approve, and send those messages as needed so they reflect anything specific you would like to add."
      );
      lines.push(
        "* If a message was marked as not needing a response but you would like to follow up anyway, you can still compose a reply as usual."
      );
      lines.push("");
      lines.push(
        "Thank you again for your patience and trust as this assistant helps you stay on top of your inbox."
      );
      lines.push("");
      lines.push("All the best,");
      lines.push("Your AI Gmail Assistant");

      const body = lines.join("\n");

      const { oauth2Client } = await getOAuthClientForAccount(account.id);
      const gmail = gmailFromAuth(oauth2Client);

      const subject = `Your AI email summary (last ${LOOKBACK_HOURS} hours)`;

      try {
        await sendEmail(gmail, account.email, subject, body);
        summariesSent += 1;
      } catch (err) {
        console.error(
          `Error sending summary email for account ${account.id}:`,
          err
        );
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