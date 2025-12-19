// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { TriageButton } from "./TriageButton";
import { RuleButtons } from "./RuleButtons";
import { Filters } from "./Filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GmailAccountRow = {
  id: string;
  email: string | null;
  updated_at: string | null;
};

type LogRow = {
  id: string;
  created_at: string;
  gmail_account_id: string;
  subject: string | null;
  from_address: string | null;
  summary: string | null;
  needs_response: boolean | null;
  priority: string | null;
  draft_created: boolean | null;
  gmail_accounts?: { email: string | null }[] | null;
};

const SUMMARY_SUBJECT_MARKERS = [
  "AI Email Summary",
  "AI Gmail Agent Summary",
  "Inbox Summary",
  "Daily Summary",
];

const SUMMARY_FROM_MARKERS = [
  // if you always send summaries from your own address, keep this empty.
  // If you send from support@drzelisko.com, add it here if needed.
  // "support@drzelisko.com",
];

async function getAccounts(): Promise<GmailAccountRow[]> {
  const { data, error } = await supabaseServer
    .from("gmail_accounts")
    .select("id, email, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading gmail_accounts", error);
    return [];
  }
  return (data || []) as GmailAccountRow[];
}

async function getLogs(): Promise<LogRow[]> {
  // Pull logs and filter out summary emails on the server side.
  // We can’t easily OR a bunch of “not ilike” in one simple query, so we filter in JS
  // after fetching the recent slice.
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select(
      "id, created_at, gmail_account_id, subject, from_address, summary, needs_response, priority, draft_created, gmail_accounts(email)"
    )
    .order("created_at", { ascending: false })
    .limit(200); // fetch a bit more since we'll remove some

  if (error) {
    console.error("Error loading logs", error);
    return [];
  }

  const rows = (data || []) as unknown as LogRow[];

  // Remove summary emails
  return rows.filter((r) => {
    const s = (r.subject || "").toLowerCase();
    const f = (r.from_address || "").toLowerCase();

    const isSummarySubject = SUMMARY_SUBJECT_MARKERS.some((m) =>
      s.includes(m.toLowerCase())
    );
    const isSummaryFrom = SUMMARY_FROM_MARKERS.some((m) =>
      f.includes(m.toLowerCase())
    );

    return !(isSummarySubject || isSummaryFrom);
  });
}

function priorityClass(p?: string | null) {
  const v = (p || "normal").toLowerCase();
  if (v === "high") return "pill pill-high";
  if (v === "low") return "pill pill-low";
  return "pill pill-normal";
}

export default async function DashboardPage() {
  const [accounts, logs] = await Promise.all([getAccounts(), getLogs()]);

  const stats = {
    connected: accounts.length,
    logs: logs.length,
    drafts: logs.filter((l) => l.draft_created).length,
    needs: logs.filter((l) => l.needs_response).length,
    high: logs.filter((l) => (l.priority || "normal") === "high").length,
  };

  const inboxEmailForLog = (log: LogRow) =>
    log.gmail_accounts?.[0]?.email ?? "—";

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <div className="logo">AI</div>
            <div className="brand-title">
              <strong>Dashboard</strong>
              <span>Lookback: last 14 days • Drafts only • Deduped</span>
            </div>
          </div>

          <div className="nav-actions">
            <Link className="btn" href="/">
              Home
            </Link>
            <a className="btn" href="/api/auth/google">
              + Connect Gmail
            </a>
            <TriageButton />
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "22px 0 40px" }}>
        <div className="grid-2">
          <div className="card">
            <div className="card-row">
              <h2>Quick actions</h2>
              <span className="pill">Live</span>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              Run triage on demand, connect additional inboxes, and review drafts
              in Gmail.
            </p>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <a
                className="btn btn-primary"
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noreferrer"
              >
                Open Gmail Drafts
              </a>
              <a className="btn" href="/api/auth/google">
                Connect another inbox
              </a>
            </div>

            <div className="kpi-grid">
              <div className="kpi">
                <div className="label">Connected inboxes</div>
                <div className="value">{stats.connected}</div>
              </div>
              <div className="kpi">
                <div className="label">Activity shown</div>
                <div className="value">{stats.logs}</div>
              </div>
              <div className="kpi">
                <div className="label">Drafts created</div>
                <div className="value">{stats.drafts}</div>
              </div>
              <div className="kpi">
                <div className="label">Needs response</div>
                <div className="value">{stats.needs}</div>
              </div>
              <div className="kpi">
                <div className="label">High priority</div>
                <div className="value">{stats.high}</div>
              </div>
            </div>

            <div className="section">
              <h3>Connected Gmail accounts</h3>
              <div className="muted" style={{ marginTop: 6 }}>
                The agent can triage all connected inboxes.
              </div>

              {accounts.length === 0 ? (
                <div className="account" style={{ marginTop: 12 }}>
                  <strong>No accounts connected</strong>
                  <div className="muted">Click “Connect Gmail” to begin.</div>
                </div>
              ) : (
                <div className="account-grid">
                  {accounts.map((a) => (
                    <div className="account" key={a.id}>
                      <strong>{a.email ?? "—"}</strong>
                      <div className="muted">
                        Updated:{" "}
                        {a.updated_at
                          ? new Date(a.updated_at).toLocaleString()
                          : "—"}
                      </div>
                      <code>{a.id}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-row">
              <h2>Recent activity</h2>
              <span className="pill">Filtered</span>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              Summary emails are hidden here. Filter by draft/priority, and use
              “Teach agent” for future behavior.
            </p>

            <Filters>
              {({ draft, priority, query }) => {
                const q = query.trim().toLowerCase();

                const filtered = logs
                  .filter((l) => {
                    if (draft === "drafted" && !l.draft_created) return false;
                    if (draft === "not_drafted" && l.draft_created) return false;

                    if (priority !== "all") {
                      const p = (l.priority || "normal").toLowerCase();
                      if (p !== priority) return false;
                    }

                    if (q) {
                      const hay = [
                        l.subject || "",
                        l.from_address || "",
                        l.summary || "",
                        inboxEmailForLog(l),
                      ]
                        .join(" ")
                        .toLowerCase();
                      if (!hay.includes(q)) return false;
                    }

                    return true;
                  })
                  .slice(0, 120);

                if (filtered.length === 0) {
                  return (
                    <div className="account" style={{ marginTop: 12 }}>
                      <strong>No activity matches your filters</strong>
                      <div className="muted">
                        Try clearing the filters or search term.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="feed">
                    {filtered.map((log) => (
                      <div className="item" key={log.id}>
                        <div>
                          <div className="item-meta">
                            <span>
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                            <span>•</span>
                            <span>{inboxEmailForLog(log)}</span>
                            <span className={priorityClass(log.priority)}>
                              {(log.priority || "normal").toLowerCase()}
                            </span>

                            {log.draft_created ? (
                              <span
                                className="pill"
                                style={{
                                  borderColor: "rgba(16,185,129,0.35)",
                                  background: "rgba(16,185,129,0.12)",
                                  color: "rgba(167,243,208,0.95)",
                                }}
                              >
                                Draft created
                              </span>
                            ) : (
                              <span className="pill">No draft</span>
                            )}
                          </div>

                          <div className="item-title">
                            {log.subject ?? "(no subject)"}
                          </div>

                          <div className="muted">
                            <b style={{ color: "rgba(255,255,255,0.72)" }}>
                              From:
                            </b>{" "}
                            {log.from_address ?? "—"}
                          </div>

                          <div className="item-summary" style={{ marginTop: 10 }}>
                            {log.summary ?? ""}
                          </div>
                        </div>

                        <div className="rule-box">
                          <div className="rule-title">Teach agent (future)</div>
                          <RuleButtons
                            gmailAccountId={log.gmail_account_id}
                            fromAddress={log.from_address ?? ""}
                            subject={log.subject ?? ""}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }}
            </Filters>

            <div className="footer">
              Tip: filter “Draft: Created” to see only the emails that will be
              included in summary emails.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}