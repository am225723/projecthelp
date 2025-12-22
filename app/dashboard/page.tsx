// app/dashboard/page.tsx
import ConnectedAccountsPanel, { ConnectedAccount } from "./ConnectedAccountsPanel";
import ActivityClient, { ActivityLog } from "./ActivityClient";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUMMARY_SUBJECT_MARKERS: string[] = ["AI Email Summary", "Inbox Summary", "AI Gmail Agent Summary"];
const SUMMARY_FROM_MARKERS: string[] = []; // subject-only safest

function isSummaryEmail(subject?: string | null, from?: string | null) {
  const s = String(subject || "").toLowerCase();
  const f = String(from || "").toLowerCase();

  const subjectMatch = SUMMARY_SUBJECT_MARKERS.some((m) => s.includes(m.toLowerCase()));
  const fromMatch = SUMMARY_FROM_MARKERS.some((m) => f.includes(m.toLowerCase()));
  return subjectMatch || fromMatch;
}

export default async function DashboardPage() {
  // Connected accounts + settings
  const { data: accounts, error: aErr } = await supabaseServer
    .from("gmail_accounts")
    .select("id,email")
    .order("email", { ascending: true });

  if (aErr) console.error("Error loading accounts", aErr);

  const { data: settings, error: sErr } = await supabaseServer
    .from("agent_settings")
    .select("gmail_account_id,enabled,run_mode,period_minutes,last_run_at");

  if (sErr) console.error("Error loading settings", sErr);

  const settingsMap = new Map<string, any>();
  (settings || []).forEach((s: any) => settingsMap.set(s.gmail_account_id, s));

  const connected: ConnectedAccount[] = (accounts || []).map((a: any) => ({
    id: String(a.id),
    email: a.email ?? null,
    settings: settingsMap.get(a.id) ?? null,
  }));

  // Activity logs
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select(
      "id, created_at, gmail_account_id, subject, from_address, summary, priority, draft_created, gmail_accounts(email)"
    )
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) console.error("Error loading logs", error);

  const rows: ActivityLog[] = ((data || []) as any[])
    .filter((r) => !isSummaryEmail(r.subject, r.from_address))
    .map((r) => {
      const inboxEmail =
        Array.isArray(r.gmail_accounts) && r.gmail_accounts.length > 0
          ? r.gmail_accounts[0]?.email ?? null
          : r.gmail_accounts?.email ?? null;

      return {
        id: String(r.id),
        created_at: String(r.created_at),
        gmail_account_id: String(r.gmail_account_id),
        inbox_email: inboxEmail,
        subject: r.subject ?? null,
        from_address: r.from_address ?? null,
        summary: r.summary ?? null,
        priority: (r.priority ?? "normal") as any,
        draft_created: r.draft_created ?? null,
      };
    });

  return (
    <main style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.9rem", margin: 0 }}>Dashboard</h1>
        <p style={{ color: "#9ca3af", marginTop: 8 }}>
          Manage connected inboxes, scheduling, and review triage activity.
        </p>
      </header>

      <ConnectedAccountsPanel accounts={connected} />
      <ActivityClient logs={rows} />
    </main>
  );
}
