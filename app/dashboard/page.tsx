// app/dashboard/page.tsx
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
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
    .limit(120);

  if (error) {
    console.error("Error loading logs", error);
    return [];
  }
  return data as LogRow[];
}

function priorityPill(p?: string | null) {
  const v = (p || "normal").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs ring-1";

  if (v === "high") return `${base} bg-red-500/15 text-red-200 ring-red-500/30`;
  if (v === "low") return `${base} bg-white/5 text-white/70 ring-white/10`;
  return `${base} bg-amber-500/15 text-amber-200 ring-amber-500/30`;
}

export default async function DashboardPage() {
  const [accounts, logs] = await Promise.all([getAccounts(), getLogs()]);

  const stats = {
    connected: accounts.length,
    logs: logs.length,
    needs: logs.filter((l) => l.needs_response).length,
    drafts: logs.filter((l) => l.draft_created).length,
    high: logs.filter((l) => (l.priority || "normal") === "high").length,
  };

  return (
    <main className="min-h-screen bg-[#050712] text-white">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_20%_10%,rgba(99,102,241,0.16),transparent_42%),radial-gradient(900px_circle_at_80%_20%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(700px_circle_at_50%_85%,rgba(236,72,153,0.08),transparent_52%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center">
                <span className="text-sm font-semibold">AI</span>
              </div>
              <div>
                <div className="text-sm font-semibold">Dashboard</div>
                <div className="text-xs text-white/60">
                  Lookback: last 14 days • Drafts only • Deduped
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                Home
              </Link>
              <a
                href="/api/auth/google"
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                + Connect Gmail
              </a>
              <TriageButton />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Top grid */}
        <section className="grid gap-4 lg:grid-cols-12">
          {/* Quick actions */}
          <div className="lg:col-span-5">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Quick actions</div>
                  <div className="mt-1 text-xs text-white/60">
                    Connect inboxes and run triage on demand.
                  </div>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                  Live
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Action
                  title="Connect another inbox"
                  desc="Add additional Gmail accounts."
                  href="/api/auth/google"
                />
                <Action
                  title="Open Gmail Drafts"
                  desc="Review drafts and send."
                  href="https://mail.google.com/mail/u/0/#drafts"
                  external
                />
              </div>

              <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Behavior</div>
                <ul className="mt-2 space-y-1 text-sm text-white/75">
                  <li>• Creates a draft only when it believes a response is needed.</li>
                  <li>• Summary email is sent only if drafts were created.</li>
                  <li>• Use rules to “skip” or “no-draft” future emails.</li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Stats */}
          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat title="Connected inboxes" value={stats.connected} />
              <Stat title="Logs shown" value={stats.logs} />
              <Stat title="Drafts created" value={stats.drafts} />
              <Stat title="Needs response" value={stats.needs} />
              <Stat title="High priority" value={stats.high} />
              <Stat title="Last triage" value="—" hint="Shown in logs below" />
            </div>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="mt-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Connected Gmail accounts</div>
                <div className="mt-1 text-xs text-white/60">
                  The agent can triage all connected inboxes.
                </div>
              </div>
              <div className="text-xs text-white/60">
                {accounts.length} connected
              </div>
            </div>

            {accounts.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
                <div className="text-sm font-semibold">No inboxes connected</div>
                <p className="mt-1 text-sm text-white/70">
                  Connect your primary Gmail account to begin triage.
                </p>
                <div className="mt-4">
                  <a
                    href="/api/auth/google"
                    className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Connect Gmail
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {accounts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {a.email ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          Updated:{" "}
                          {a.updated_at
                            ? new Date(a.updated_at).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                        Connected
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-white/45 break-all">
                      {a.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Activity feed */}
        <section className="mt-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Recent activity</div>
                <div className="mt-1 text-xs text-white/60">
                  Latest 120 triaged emails across inboxes.
                </div>
              </div>
              <div className="text-xs text-white/60">
                Showing {logs.length}
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
                <div className="text-sm font-semibold">No logs yet</div>
                <p className="mt-1 text-sm text-white/70">
                  Run triage after connecting at least one inbox.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-white/60">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          <span className="text-xs text-white/60">•</span>
                          <span className="text-xs text-white/70">
                            {log.gmail_accounts?.email ?? "—"}
                          </span>
                          <span className={priorityPill(log.priority)}>
                            {(log.priority || "normal").toLowerCase()}
                          </span>
                          {log.draft_created ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
                              Draft created
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/70 ring-1 ring-white/10">
                              No draft
                            </span>
                          )}
                          {log.needs_response ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-1 text-xs text-indigo-200 ring-1 ring-indigo-500/30">
                              Needs response
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/70 ring-1 ring-white/10">
                              No response needed
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-base font-semibold truncate">
                          {log.subject ?? "(no subject)"}
                        </div>
                        <div className="mt-1 text-sm text-white/75 truncate">
                          <span className="text-white/60">From: </span>
                          {log.from_address ?? "—"}
                        </div>

                        {!!log.summary && (
                          <div className="mt-3 text-sm text-white/70 whitespace-pre-wrap">
                            {log.summary}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        <div className="text-xs text-white/60 mb-2">
                          Teach agent (future)
                        </div>
                        <RuleButtons
                          gmailAccountId={log.gmail_account_id}
                          fromAddress={log.from_address ?? ""}
                          subject={log.subject ?? ""}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <div className="mt-10 text-xs text-white/45">
          Tip: Use “No-draft sender/subject” for newsletters or senders you want to label/triage but never draft replies to.
        </div>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
      {children}
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/45">{hint}</div>}
    </div>
  );
}

function Action({
  title,
  desc,
  href,
  external,
}: {
  title: string;
  desc: string;
  href: string;
  external?: boolean;
}) {
  const cls =
    "block rounded-2xl bg-black/30 p-4 ring-1 ring-white/10 hover:bg-black/35 transition";
  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{desc}</div>
    </Link>
  );
}