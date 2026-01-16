"use client";

import { useState } from "react";
import { runTriageAction } from "@/app/actions";

export function TriageButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const data = await runTriageAction();

      setStatus(
        `Completed: processed ${data.processed ?? 0} email(s) across ${data.accounts ?? 0} inbox(es).`
      );
    } catch (e: any) {
      console.error(e);
      setStatus(e.message || "Unexpected error running triage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
      >
        {loading ? "Running…" : "Run triage"}
      </button>

      {status && (
        <div className="max-w-sm rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70 ring-1 ring-white/10">
          {status}
        </div>
      )}
    </div>
  );
}
