// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <div className="logo">AI</div>
            <div className="brand-title">
              <strong>AI Gmail Agent</strong>
              <span>Drafts • Rules • Summaries</span>
            </div>
          </div>

          <div className="nav-actions">
            <Link className="btn" href="/dashboard">
              Dashboard
            </Link>
            <a className="btn btn-primary" href="/api/auth/google">
              Connect Gmail
            </a>
          </div>
        </div>
      </div>

      <div className="container hero">
        <span className="badge">
          <span className="dot" />
          Live triage, drafts only, deduped
        </span>

        <h1>Triage email automatically — without losing control.</h1>
        <p>
          The agent reviews your inbox (last 14 days), applies labels, drafts replies in your voice,
          and sends a summary <b>only when drafts were created</b>.
        </p>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn btn-primary" href="/api/auth/google">Connect a Gmail account</a>
          <Link className="btn" href="/dashboard">Open dashboard</Link>
          <a className="btn" href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer">
            Open Gmail Drafts
          </a>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-row">
              <h2>What it does</h2>
              <span className="pill">Lookback: 14 days</span>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Designed for real workflows: triage + draft, then you approve and send.
            </p>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="account">
                <strong>Drafts, not auto-send</strong>
                <div className="muted">It creates drafts only. You stay in control.</div>
              </div>
              <div className="account">
                <strong>No duplicates</strong>
                <div className="muted">Database constraint + job logic prevents re-drafting.</div>
              </div>
              <div className="account">
                <strong>Teach it rules</strong>
                <div className="muted">Skip or “no-draft” future emails by sender/subject.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Recommended setup</h2>
            <p className="muted" style={{ marginTop: 10 }}>
              Connect your main inbox first, run triage once, confirm drafts/labels, then connect any additional inboxes.
            </p>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="account">
                <strong>Step 1</strong>
                <div className="muted">Connect Gmail via OAuth</div>
              </div>
              <div className="account">
                <strong>Step 2</strong>
                <div className="muted">Run triage (or schedule cron)</div>
              </div>
              <div className="account">
                <strong>Step 3</strong>
                <div className="muted">Review drafts in Gmail and send</div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          Drafts only • Summary only on drafts • Multi-inbox supported
        </div>
      </div>
    </>
  );
}