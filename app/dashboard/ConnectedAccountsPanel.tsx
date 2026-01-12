"use client";

import { useMemo, useState } from "react";

type RunMode = "periodic" | "instant";

export type ConnectedAccount = {
  id: string;
  email: string | null;
  settings?: {
    enabled: boolean;
    run_mode: RunMode;
    period_minutes: number;
    last_run_at: string | null;
  } | null;
};

const PERIOD_OPTIONS = [
  { label: "Every 5 minutes", minutes: 5 },
  { label: "Every 15 minutes", minutes: 15 },
  { label: "Every 30 minutes", minutes: 30 },
  { label: "Every 1 hour", minutes: 60 },
  { label: "Every 2 hours", minutes: 120 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Every 12 hours", minutes: 720 },
  { label: "Every 24 hours", minutes: 1440 },
];

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return "—";
  return t.toLocaleString();
}

export default function ConnectedAccountsPanel({ accounts }: { accounts: ConnectedAccount[] }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  const sorted = useMemo(() => {
    return [...accounts].sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));
  }, [accounts]);

  async function save(accountId: string, patch: { enabled?: boolean; runMode?: RunMode; periodMinutes?: number }) {
    setSavingId(accountId);
    setToast("");
    try {
      const res = await fetch("/api/settings/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gmailAccountId: accountId,
          enabled: patch.enabled,
          runMode: patch.runMode,
          periodMinutes: patch.periodMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");

      setToast("Saved ✅  Refresh the page to see updated last-run time.");
      setTimeout(() => setToast(""), 3500);
    } catch (e: any) {
      setToast(`Error: ${e?.message || "Failed"}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header-row">
        <div>
          <h2>Connected Gmail Accounts</h2>
          <p className="panel-subtitle">
            Each Gmail account is connected via OAuth once. Choose how the agent should run per inbox.
          </p>
        </div>

        {toast ? <div className="panel-subtitle">{toast}</div> : null}
      </div>

      <div className="table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Inbox</th>
              <th>Enabled</th>
              <th>Mode</th>
              <th>Frequency</th>
              <th>Last run</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((a) => {
              const enabled = a.settings?.enabled ?? true;
              const runMode = (a.settings?.run_mode ?? "periodic") as RunMode;
              const periodMinutes = a.settings?.period_minutes ?? 60;

              return (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{a.email || "—"}</td>

                  <td>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => save(a.id, { enabled: e.target.checked })}
                        disabled={savingId === a.id}
                      />
                      {enabled ? "On" : "Off"}
                    </label>
                  </td>

                  <td>
                    <select
                      value={runMode}
                      onChange={(e) => save(a.id, { runMode: e.target.value as RunMode })}
                      disabled={savingId === a.id}
                      className="select"
                    >
                      <option value="periodic">Periodic</option>
                      <option value="instant">Instant (requires Gmail push)</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={periodMinutes}
                      onChange={(e) => save(a.id, { periodMinutes: Number(e.target.value) })}
                      disabled={savingId === a.id || runMode !== "periodic"}
                      className="select"
                    >
                      {PERIOD_OPTIONS.map((o) => (
                        <option key={o.minutes} value={o.minutes}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="table-muted" style={{ whiteSpace: "nowrap" }}>
                    {formatWhen(a.settings?.last_run_at ?? null)}
                  </td>

                  <td>
                    <a
                      href="/api/auth/google"
                      className="btn btn-ghost btn-sm"
                      title="Connect another Gmail account"
                    >
                      + Connect another
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel-subtitle" style={{ marginTop: 12 }}>
        Periodic mode is controlled by a Vercel cron that runs every 5 minutes and only triggers triage when each inbox is due.
      </div>
    </section>
  );
}
