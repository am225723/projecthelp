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
    <section
      style={{
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: 16,
        background: "rgba(2,6,23,0.85)",
        padding: 16,
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "rgba(226,232,240,0.95)" }}>
            Connected Gmail Accounts
          </h2>
          <p style={{ margin: "6px 0 0", color: "rgba(148,163,184,0.95)", fontSize: "0.9rem" }}>
            Each Gmail account is connected via OAuth once. Choose how the agent should run per inbox.
          </p>
        </div>

        {toast ? (
          <div style={{ color: "rgba(226,232,240,0.9)", fontSize: "0.9rem" }}>{toast}</div>
        ) : null}
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Inbox</th>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Enabled</th>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Mode</th>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Frequency</th>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Last run</th>
              <th align="left" style={{ padding: "10px 8px", color: "rgba(226,232,240,0.9)" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((a) => {
              const enabled = a.settings?.enabled ?? true;
              const runMode = (a.settings?.run_mode ?? "periodic") as RunMode;
              const periodMinutes = a.settings?.period_minutes ?? 60;

              return (
                <tr key={a.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.10)" }}>
                  <td style={{ padding: "12px 8px", color: "rgba(226,232,240,0.92)", whiteSpace: "nowrap" }}>
                    {a.email || "—"}
                  </td>

                  <td style={{ padding: "12px 8px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.85)" }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => save(a.id, { enabled: e.target.checked })}
                        disabled={savingId === a.id}
                      />
                      {enabled ? "On" : "Off"}
                    </label>
                  </td>

                  <td style={{ padding: "12px 8px" }}>
                    <select
                      value={runMode}
                      onChange={(e) => save(a.id, { runMode: e.target.value as RunMode })}
                      disabled={savingId === a.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(148,163,184,0.20)",
                        color: "rgba(226,232,240,0.95)",
                      }}
                    >
                      <option value="periodic">Periodic</option>
                      <option value="instant">Instant (requires Gmail push)</option>
                    </select>
                  </td>

                  <td style={{ padding: "12px 8px" }}>
                    <select
                      value={periodMinutes}
                      onChange={(e) => save(a.id, { periodMinutes: Number(e.target.value) })}
                      disabled={savingId === a.id || runMode !== "periodic"}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: runMode === "periodic" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(148,163,184,0.20)",
                        color: "rgba(226,232,240,0.95)",
                      }}
                    >
                      {PERIOD_OPTIONS.map((o) => (
                        <option key={o.minutes} value={o.minutes}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: "12px 8px", color: "rgba(148,163,184,0.95)", whiteSpace: "nowrap" }}>
                    {formatWhen(a.settings?.last_run_at ?? null)}
                  </td>

                  <td style={{ padding: "12px 8px" }}>
                    <a
                      href="/api/auth/google"
                      style={{
                        display: "inline-block",
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,0.20)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(226,232,240,0.95)",
                        textDecoration: "none",
                      }}
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

      <div style={{ marginTop: 12, color: "rgba(148,163,184,0.9)", fontSize: "0.85rem" }}>
        Periodic mode is controlled by a Vercel cron that runs every 5 minutes and only triggers triage when each inbox is due.
      </div>
    </section>
  );
}
