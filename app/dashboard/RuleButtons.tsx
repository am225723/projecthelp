"use client";

import { useState } from "react";

export function RuleButtons({
  gmailAccountId,
  fromAddress,
  subject,
}: {
  gmailAccountId: string;
  fromAddress: string;
  subject: string;
}) {
  const [saving, setSaving] = useState<null | "sender" | "subject">(null);
  const [done, setDone] = useState<string>("");

  async function createRule(type: "skip_sender" | "skip_subject", pattern: string) {
    setDone("");
    setSaving(type === "skip_sender" ? "sender" : "subject");

    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gmailAccountId,
          type,
          pattern,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "Failed");

      setDone(type === "skip_sender" ? "Sender skipped ✅" : "Subject skipped ✅");
    } catch (e: any) {
      setDone(`Error: ${e?.message || "Failed"}`);
    } finally {
      setSaving(null);
      setTimeout(() => setDone(""), 3500);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => createRule("skip_sender", fromAddress)}
          disabled={!fromAddress || saving !== null}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(226,232,240,0.95)",
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
          }}
          title="Future: do not draft replies to this sender"
        >
          {saving === "sender" ? "Saving…" : "Skip sender"}
        </button>

        <button
          onClick={() => createRule("skip_subject", subject)}
          disabled={!subject || saving !== null}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(226,232,240,0.95)",
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
          }}
          title="Future: do not draft replies for this subject"
        >
          {saving === "subject" ? "Saving…" : "Skip subject"}
        </button>
      </div>

      {done ? (
        <div style={{ color: "rgba(226,232,240,0.8)", fontSize: "0.8rem" }}>
          {done}
        </div>
      ) : null}
    </div>
  );
}