"use client";

import { useState } from "react";

export function TriageButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleRunTriage = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/jobs/run-triage", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data?.error ? `Error: ${data.error}` : `Error: HTTP ${res.status}`);
        return;
      }

      setStatus(
        `Done — processed ${data.processed ?? 0} email(s) across ${data.accounts ?? 0} account(s).`
      );
    } catch (err) {
      console.error(err);
      setStatus("Unexpected error running triage. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRunTriage}
        disabled={loading}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-60"
      >
        {loading ? "Running triage..." : "Run triage now"}
      </button>
      {status && <p className="text-xs text-white/70 max-w-sm text-right">{status}</p>}
    </div>
  );
}
