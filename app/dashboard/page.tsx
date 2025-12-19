// app/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050712] text-white">
      {/* Subtle background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(99,102,241,0.18),transparent_45%),radial-gradient(900px_circle_at_80%_30%,rgba(16,185,129,0.12),transparent_45%),radial-gradient(700px_circle_at_50%_80%,rgba(236,72,153,0.10),transparent_50%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Top nav */}
      <header className="mx-auto max-w-6xl px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10 ring-1 ring-white/10 grid place-items-center">
              <span className="text-sm font-semibold">AI</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">AI Gmail Agent</div>
              <div className="text-xs text-white/60">
                Drafts • Labels • Rules • Summaries
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
            >
              Dashboard
            </Link>
            <a
              href="/api/auth/google"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Connect Gmail
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
              Runs on your Gmail + Supabase + AI
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
              Triage every inbox. Draft replies in your voice. Stay in control.
            </h1>

            <p className="mt-4 max-w-xl text-base text-white/70">
              This agent reads inbox messages, applies labels, creates drafts when appropriate,
              and sends a summary only when drafts are created — so you’re never spammed.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/api/auth/google"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Connect a Gmail account
              </a>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                Open dashboard
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Feature
                title="Drafts, not auto-send"
                desc="The agent creates drafts only — you review and send."
              />
              <Feature
                title="No duplicates"
                desc="DB + logic prevents re-drafting the same email."
              />
              <Feature
                title="Rules you control"
                desc="Skip or no-draft future messages by sender/subject."
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">How it works</div>
                  <div className="mt-1 text-xs text-white/60">
                    Simple workflow designed for real inboxes.
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                  Last 14 days
                </div>
              </div>

              <ol className="mt-5 space-y-3 text-sm text-white/75">
                <Step n="1" t="Connect one or more Gmail accounts" />
                <Step n="2" t="Run triage (or schedule via cron)" />
                <Step n="3" t="Agent labels messages + drafts replies" />
                <Step n="4" t="You review drafts and approve/send" />
                <Step n="5" t="Summary email sent only when drafts were created" />
              </ol>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>Multi-inbox</Badge>
                <Badge>HTML signature</Badge>
                <Badge>Rules (skip / no-draft)</Badge>
                <Badge>Supabase logs</Badge>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
              <div className="text-sm font-semibold">Recommended next step</div>
              <p className="mt-2 text-sm text-white/70">
                Connect your primary inbox first, run triage once, and verify labels + drafts.
                Then connect additional inboxes.
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="/api/auth/google"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Connect Gmail
                </a>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
                >
                  View logs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} AI Gmail Agent</div>
          <div>
            Drafts only • Summary only on drafts • Lookback: 14 days
          </div>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/65">{desc}</div>
    </div>
  );
}

function Step({ n, t }: { n: string; t: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-lg bg-white/5 text-xs text-white/80 ring-1 ring-white/10">
        {n}
      </div>
      <div className="leading-relaxed">{t}</div>
    </li>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
      {children}
    </span>
  );
}