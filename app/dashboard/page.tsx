import ActivityClient, { ActivityLog } from "./ActivityClient";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Exclude summary emails from the activity feed
const SUMMARY_SUBJECT_MARKERS: string[] = ["AI Email Summary", "Inbox Summary"];
const SUMMARY_FROM_MARKERS: string[] = []; // safest: subject-only

function isSummaryEmail(subject?: string | null, from?: string | null) {
  const s = String(subject || "").toLowerCase();
  const f = String(from || "").toLowerCase();

  const subjectMatch = SUMMARY_SUBJECT_MARKERS.some((m) =>
    s.includes(m.toLowerCase())
  );
  const fromMatch = SUMMARY_FROM_MARKERS.some((m) => f.includes(m.toLowerCase()));

  return subjectMatch || fromMatch;
}

export default async function DashboardPage() {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select(
      "id, created_at, subject, from_address, summary, priority, draft_created, gmail_accounts(email)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Error loading logs", error);
  }

  const rows = ((data || []) as any[])
    .filter((r) => !isSummaryEmail(r.subject, r.from_address))
    .map((r) => {
      const inboxEmail =
        Array.isArray(r.gmail_accounts) && r.gmail_accounts.length > 0
          ? r.gmail_accounts[0]?.email ?? null
          : r.gmail_accounts?.email ?? null;

      const out: ActivityLog = {
        id: String(r.id),
        created_at: String(r.created_at),
        inbox_email: inboxEmail,
        subject: r.subject ?? null,
        from_address: r.from_address ?? null,
        summary: r.summary ?? null,
        priority: (r.priority ?? "normal") as any,
        draft_created: r.draft_created ?? null,
      };

      return out;
    });

  return (
    <main style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>Inbox Activity</h1>
        <p style={{ color: "#9ca3af", margin: 0 }}>
          Filter by draft created, priority level, and search text.
        </p>
      </header>

      <ActivityClient logs={rows} />
    </main>
  );
}