import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type LogRow = {
  id: string;
  created_at: string;
  subject: string | null;
  from_address: string | null;
  summary: string | null;
  needs_response: boolean | null;
  priority: string | null;
  draft_created: boolean | null;
  gmail_accounts?: {
    email: string | null;
  } | null;
};

async function getLogs(): Promise<LogRow[]> {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select("id, created_at, subject, from_address, summary, needs_response, priority, draft_created, gmail_accounts(email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error loading logs", error);
    return [];
  }
  return data as LogRow[];
}

export default async function DashboardPage() {
  const logs = await getLogs();

  return (
    <main>
      <section
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem"
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Inbox Activity</h2>
          <p style={{ marginTop: "0.35rem", color: "#9ca3af", fontSize: "0.9rem" }}>
            A quick view of the most recent emails the agent has triaged, drafted, and summarized.
          </p>
        </div>
      </section>

      <section
        style={{
          borderRadius: "1rem",
          border: "1px solid #1f2937",
          backgroundColor: "#020617",
          padding: "1.25rem 1rem",
          boxShadow: "0 12px 30px rgba(0,0,0,0.4)"
        }}
      >
        {logs.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            No email logs found yet. Once the cron job runs and the agent starts triaging, entries will appear here.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Inbox</th>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Priority</th>
                  <th>Needs Reply?</th>
                  <th>Draft?</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.gmail_accounts?.email ?? "—"}</td>
                    <td>{log.subject ?? "(no subject)"}</td>
                    <td>{log.from_address ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{log.priority ?? "normal"}</td>
                    <td>{log.needs_response ? "Yes" : "No"}</td>
                    <td>{log.draft_created ? "Draft created" : "—"}</td>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ display: "inline-block", whiteSpace: "pre-wrap" }}>
                        {log.summary ?? ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
