import { supabaseServer } from "@/lib/supabase-server";
import { TriageButton } from "./TriageButton";
import { RuleButtons } from "./RuleButtons";

export const dynamic = "force-dynamic";

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
    .limit(150);

  if (error) {
    console.error("Error loading logs", error);
    return [];
  }
  return data as LogRow[];
}

function pill(priority: string | null) {
  const p = (priority || "normal").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2 py-1 text-xs ring-1";

  if (p === "high") return `${base} bg-red-500/15 text-red-200 ring-red-500/30`;
  if (p === "low") return `${base} bg-white/5 text-white/70 ring-white/10`;
  return `${base} bg-amber-500/15 text-amber-200 ring-amber-500/30`;
}

export default async function DashboardPage() {
  const [accounts, logs] = await Promise.all([getAccounts(), getLogs()]);

  const total = logs.length;
  const drafts = logs.filter((l) => l.draft_created).length;
  const needs = logs.filter((l) => l.needs_response).length;
  const high = logs.filter((l) => (l.priority || "normal") === "high").length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              AI Gmail Agent
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Review the last 14 days, create drafts when appropriate, and keep everything deduplicated.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/api/auth/google"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              + Connect Gmail
            </a>
            <TriageButton />
          </div>
        </header>

        {/* Stats */}
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Connected inboxes</div>
            <div className="mt-2 text-2xl font-semibold">{accounts.length}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Logs shown</div>
            <div className="mt-2 text-2xl font-semibold">{total}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Needs response</div>
            <div className="mt-2 text-2xl font-semibold">{needs}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Drafts created</div>
            <div className="mt-2 text-2xl font-semibold">{drafts}</div>
            <div className="mt-1 text-xs text-white/50">
              Summary emails only send when drafts are created.
            </div>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Connected Gmail accounts</h2>
            <span className="text-xs text-white/60">
              {accounts.length} connected
            </span>
          </div>

          {accounts.length === 0 ? (
            <p className="mt-3 text-sm text-white/70">
              No accounts connected yet. Click <span className="font-semibold">Connect Gmail</span>.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10"
                >
                  <div className="text-sm font-semibold">{a.email ?? "—"}</div>
                  <div className="mt-1 text-xs text-white/60">
                    Updated: {a.updated_at ? new Date(a.updated_at).toLocaleString() : "—"}
                  </div>
                  <div className="mt-2 text-[11px] text-white/40">ID: {a.id}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Logs table */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent triage activity</h2>
            <span className="text-xs text-white/60">Latest 150</span>
          </div>

          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-white/70">
              No logs yet. Run triage after connecting an inbox.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-4">When</th>
                    <th className="py-3 pr-4">Inbox</th>
                    <th className="py-3 pr-4">Subject</th>
                    <th className="py-3 pr-4">From</th>
                    <th className="py-3 pr-4">Priority</th>
                    <th className="py-3 pr-4">Needs Reply</th>
                    <th className="py-3 pr-4">Draft</th>
                    <th className="py-3 pr-4">Summary</th>
                    <th className="py-3 pr-2">Rules</th>
                  </tr>
                </thead>

                <tbody className="align-top">
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5">
                      <td className="py-4 pr-4 text-xs text-white/70 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td className="py-4 pr-4 text-xs text-white/70 whitespace-nowrap">
                        {log.gmail_accounts?.email ?? "—"}
                      </td>

                      <td className="py-4 pr-4 font-semibold">
                        {log.subject ?? "(no subject)"}
                      </td>

                      <td className="py-4 pr-4 text-white/80">
                        {log.from_address ?? "—"}
                      </td>

                      <td className="py-4 pr-4">
                        <span className={pill(log.priority)}>{(log.priority || "normal").toLowerCase()}</span>
                      </td>

                      <td className="py-4 pr-4 text-white/80">
                        {log.needs_response ? "Yes" : "No"}
                      </td>

                      <td className="py-4 pr-4 text-white/80">
                        {log.draft_created ? "Created" : "—"}
                      </td>

                      <td className="py-4 pr-4 text-xs text-white/70 max-w-md">
                        <div className="whitespace-pre-wrap">{log.summary ?? ""}</div>
                      </td>

                      <td className="py-4 pr-2">
                        <RuleButtons
                          gmailAccountId={log.gmail_account_id}
                          fromAddress={log.from_address ?? ""}
                          subject={log.subject ?? ""}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-white/40">
          Notes: This dashboard shows recent logs. The triage job reviews the last 14 days and will not create duplicate drafts.
        </footer>
      </div>
    </main>
  );
}