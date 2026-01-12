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
            <Link className="btn btn-ghost" href="/dashboard">
              Dashboard
            </Link>
            <a className="btn btn-primary" href="/api/auth/google">
              Connect Gmail
            </a>
          </div>
        </div>
      </div>

      <main className="home-shell">
        <section className="container hero-section">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Live triage, drafts only, deduped</span>
              <h1>Triage email automatically — without losing control.</h1>
              <p>
                Let the agent scan the last 14 days, label important threads, and draft replies in your voice.
                You stay in charge: we only create drafts and send a summary when new drafts exist.
              </p>

              <div className="hero-actions">
                <a className="btn btn-primary" href="/api/auth/google">Connect a Gmail account</a>
                <Link className="btn btn-ghost" href="/dashboard">Open dashboard</Link>
                <a
                  className="btn btn-ghost"
                  href="https://mail.google.com/mail/u/0/#drafts"
                  target="_blank"
                  rel="noreferrer"
                >
                  Review Gmail drafts
                </a>
              </div>

              <div className="hero-metrics">
                <div className="metric-card">
                  <span>Lookback window</span>
                  <strong>14 days</strong>
                </div>
                <div className="metric-card">
                  <span>Automation style</span>
                  <strong>Drafts only</strong>
                </div>
                <div className="metric-card">
                  <span>Coverage</span>
                  <strong>Multi-inbox</strong>
                </div>
              </div>
            </div>

            <div className="hero-panel">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3>Today at a glance</h3>
                    <p>Approve, send, and keep learning with every draft.</p>
                  </div>
                  <span className="pill">Drafts only</span>
                </div>
                <div className="panel-list">
                  <div>
                    <strong>Smart triage</strong>
                    <span>Detects priority, tags threads, and suggests actions.</span>
                  </div>
                  <div>
                    <strong>Voice matching</strong>
                    <span>Drafts mimic your tone using recent conversations.</span>
                  </div>
                  <div>
                    <strong>Summary email</strong>
                    <span>One digest whenever drafts were created.</span>
                  </div>
                </div>
              </div>

              <div className="panel-card gradient-card">
                <h3>Recommended setup</h3>
                <ol>
                  <li>Connect your main inbox via OAuth.</li>
                  <li>Run triage once to review labels + drafts.</li>
                  <li>Invite additional inboxes when ready.</li>
                </ol>
                <a className="btn btn-light" href="/api/auth/google">Connect inbox</a>
              </div>
            </div>
          </div>
        </section>

        <section className="container section">
          <div className="section-header">
            <div>
              <h2>Designed for real workflows</h2>
              <p>Everything is tuned for quality drafts, not auto-sending.</p>
            </div>
            <Link className="btn btn-ghost" href="/dashboard">View dashboard</Link>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <h3>Drafts, not auto-send</h3>
              <p>Every reply stays in Gmail drafts so you can review and approve before sending.</p>
            </div>
            <div className="feature-card">
              <h3>No duplicates</h3>
              <p>Database safeguards and job logic prevent re-drafting the same conversation.</p>
            </div>
            <div className="feature-card">
              <h3>Teach it rules</h3>
              <p>Skip or “no-draft” future emails by sender or subject with a single click.</p>
            </div>
          </div>
        </section>

        <section className="container section">
          <div className="workflow">
            <div>
              <h2>How the agent works</h2>
              <p>Keep your inbox tidy without sacrificing the personal touch.</p>
            </div>
            <div className="workflow-grid">
              <div>
                <span className="step">Step 1</span>
                <h4>Connect Gmail</h4>
                <p>OAuth keeps credentials secure and easy to revoke.</p>
              </div>
              <div>
                <span className="step">Step 2</span>
                <h4>Run triage</h4>
                <p>Labels, priority, and drafts are created for you to review.</p>
              </div>
              <div>
                <span className="step">Step 3</span>
                <h4>Approve + learn</h4>
                <p>Send drafts and apply rules to keep improving future results.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="container section">
          <div className="cta-banner">
            <div>
              <h2>Ready to reclaim your inbox?</h2>
              <p>Connect your Gmail once and let the agent keep drafts flowing.</p>
            </div>
            <div className="cta-actions">
              <a className="btn btn-light" href="/api/auth/google">Connect Gmail</a>
              <Link className="btn btn-ghost" href="/dashboard">Explore dashboard</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
