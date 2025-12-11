import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section
        style={{
          background: "linear-gradient(135deg, #111827, #020617)",
          borderRadius: "1rem",
          padding: "2rem 1.75rem",
          border: "1px solid #1f2937",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)"
        }}
      >
        <h2 style={{ fontSize: "1.6rem", marginTop: 0 }}>Welcome</h2>
        <p style={{ color: "#9ca3af", maxWidth: 640 }}>
          Connect your Gmail inbox so your AI assistant can read new emails, decide whether they need a
          response, draft replies in your voice, apply labels, and send you a clear periodic summary.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link
            href="/api/auth/google"
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              backgroundColor: "#2563eb",
              color: "#f9fafb",
              fontWeight: 500,
              fontSize: "0.95rem",
              boxShadow: "0 10px 25px rgba(37,99,235,0.35)"
            }}
          >
            Connect Gmail
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              border: "1px solid #374151",
              fontSize: "0.95rem",
              color: "#e5e7eb"
            }}
          >
            View Dashboard
          </Link>
        </div>
        <div style={{ marginTop: "2rem", display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid #1f2937", backgroundColor: "#020617" }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Thoughtful triage</h3>
            <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              Every email is summarized, evaluated for whether a response is needed, and prioritized.
            </p>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid #1f2937", backgroundColor: "#020617" }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Replies in your voice</h3>
            <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              Draft replies reflect your professional, empathetic, and highly-structured style.
            </p>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid #1f2937", backgroundColor: "#020617" }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Clear summaries</h3>
            <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              You receive concise summaries of what arrived, what was labeled, and which drafts await approval.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
