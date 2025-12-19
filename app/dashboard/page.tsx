"use client";

import { useState } from "react";

export function TriageButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/jobs/run-triage", {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error ? `Error: ${data.error}` : "Error running triage.");
        return;
      }

      setMsg(
        `Done. Processed ${data.processed ?? 0} email(s) across ${data.accounts ?? 0} inbox(es).`
      );
    } catch (e) {
      console.error(e);
      setMsg("Unexpected error. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button className="btn btn-primary" onClick={run} disabled={loading}>
        {loading ? "Running…" : "Run triage"}
      </button>
      {msg && <div className="pill" style={{ maxWidth: 360 }}>{msg}</div>}
    </div>
  );
}