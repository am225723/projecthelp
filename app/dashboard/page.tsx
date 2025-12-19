import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/* ================= TYPES ================= */

type GmailAccount = {
  email: string | null;
};

type LogRow = {
  id: string;
  created_at: string;
  subject: string | null;
  from_address: string | null;
  summary: string | null;
  needs_response: boolean | null;
  priority: "low" | "normal" | "high" | null;
  draft_created: boolean | null;
  gmail_accounts: GmailAccount | null;
};

/* ================= CONFIG ================= */

// Subjects used by AI summary emails (exclude from activity table)
const SUMMARY_SUBJECT_MARKERS: string[] = [
  "AI email summary",
  "AI Gmail Agent Summary",
  "Inbox Summary",
];

// Optional: exclude by sender if needed
const SUMMARY_FROM_MARKERS: string[] = [
  // "support@drzelisko.com",
];

/* ================= DATA ================= */

async function getLogs(): Promise<LogRow[]> {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select(`
      id,
      created_at,
      subject,
      from_address,
      summary,
      needs_response,
      priority,
      draft_created,
      gmail_accounts (
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    console.error("Failed to load logs", error);
    return [];
  }

  return data as unknown as LogRow[];
}

/* ================= HELPERS ================= */

function isSummaryEmail(log: LogRow): boolean {
  const subject = log.subject?.toLowerCase() ?? "";
  const from = log.from_address?.toLowerCase() ?? "";

  const subjectMatch = SUMMARY_SUBJECT_MARKERS.some((s) =>
    subject.includes(s.toLowerCase())
  );

  const fromMatch = SUMMARY_FROM_MARKERS.some((f) =>
    from.includes(f.toLowerCase())
  );

  return subjectMatch || fromMatch;
}

/* ================= PAGE ================= */

export default async function DashboardPage() {
  const logs = await getLogs();

  // Exclude summary emails
  const filteredLogs = logs.filter((l) => !isSummaryEmail(l));

  return (
    <main
      style={{
        padding: "2rem",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.25rem" }}>
          Inbox Activity
        </h1>
        <p style={{ color: "#6b7280" }}>
          Emails reviewed by your AI assistant in the last 14 days.
        </p>
      </header>

      {/* FILTER HINT */}
      <section
        style={{
          marginBottom: "1rem",
          fontSize: "0.85rem",
          color: "#9ca3af",
        }}
      >
        Showing emails that were triaged by the agent.  
        AI-generated summary emails are hidden.
      </section>

      {/* TABLE */}
      <section
        style={{
          border: "1px solid #1f2937",
          borderRadius: "0.75rem",
          overflowX: "auto",
        }}
      >
        {filteredLogs.length === 0 ? (
          <p style={{ padding: "1rem", color: "#9ca3af" }}>
            No email activity yet.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ background: "#020617" }}>
                <th align="left">Date</th>
                <th align="left">Inbox</th>
                <th align="left">Subject</th>
                <th align="left">From</th>
                <th align="center">Priority</th>
                <th align="center">Draft</th>
                <th align="left">Summary</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderTop: "1px solid #1f2937" }}>
                  <td>
                    {new Date(log.created_at).toLocaleString()}
                  </td>

                  <td>
                    {log.gmail_accounts?.email ?? "—"}
                  </td>

                  <td>
                    {log.subject ?? "(no subject)"}
                  </td>

                  <td>
                    {log.from_address ?? "—"}
                  </td>

                  <td align="center" style={{ textTransform: "capitalize" }}>
                    {log.priority ?? "normal"}
                  </td>

                  <td align="center">
                    {log.draft_created ? "✓" : "—"}
                  </td>

                  <td style={{ maxWidth: 420 }}>
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {log.summary ?? ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}