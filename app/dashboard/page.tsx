// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { TriageButton } from "./TriageButton";
import { RuleButtons } from "./RuleButtons";

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
  gmail_accounts?: { email: string | null } | null;
};

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
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select(
      "id, created_at, gmail_account_id, subject, from_address, summary, needs_response, priority, draft_created, gmail_accounts(email)"
    )
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    console.error("Error loading logs", error);
    return [];
  }
  return data as LogRow[];
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
              Run triage on demand, connect additional inboxes, and review drafts in Gmail.
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
                <div className="label">Logs shown</div>
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
              <span className="pill">Latest 120</span>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              Use “Teach agent” to skip or no-draft similar emails in the future.
            </p>

            {logs.length === 0 ? (
              <div className="account" style={{ marginTop: 12 }}>
                <strong>No logs yet</strong>
                <div className="muted">Run triage after connecting an inbox.</div>
              </div>
            ) : (
              <div className="feed">
                {logs.map((log) => (
                  <div className="item" key={log.id}>
                    <div>
                      <div className="item-meta">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>{log.gmail_accounts?.email ?? "—"}</span>
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

                        {log.needs_response ? (
                          <span
                            className="pill"
                            style={{
                              borderColor: "rgba(99,102,241,0.32)",
                              background: "rgba(99,102,241,0.14)",
                              color: "rgba(199,210,254,0.95)",
                            }}
                          >
                            Needs response
                          </span>
                        ) : (
                          <span className="pill">No response needed</span>
                        )}
                      </div>

                      <div className="item-title">
                        {log.subject ?? "(no subject)"}
                      </div>

                      <div className="muted">
                        <b style={{ color: "rgba(255,255,255,0.72)" }}>From:</b>{" "}
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
            )}

            <div className="footer">
              Summary emails are sent only when drafts are created.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}