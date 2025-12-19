"use client";

import { useState } from "react";

type Props = {
  gmailAccountId: string;
  fromAddress: string;
  subject: string;
};

async function createRule(payload: {
  gmail_account_id: string;
  rule_type: "from" | "subject_contains";
  pattern: string;
  action: "skip" | "no_draft";
}) {
  const res = await fetch("/api/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}

export function RuleButtons({ gmailAccountId, fromAddress, subject }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const safeFrom = (fromAddress || "").trim();
  const safeSubject = (subject || "").trim();

  const run = async (
    key: string,
    rule_type: "from" | "subject_contains",
    pattern: string,
    action: "skip" | "no_draft"
  ) => {
    setBusy(key);
    setMsg(null);

    try {
      const { ok, data } = await createRule({
        gmail_account_id: gmailAccountId,
        rule_type,
        pattern,
        action,
      });

      if (!ok) {
        setMsg(data?.error ? `Error: ${data.error}` : "Failed to save rule.");
        return;
      }

      setMsg(
        action === "no_draft"
          ? "Saved: triage still runs, but no draft will be created."
          : "Saved: future matches will be skipped."
      );
    } catch (e) {
      console.error(e);
      setMsg("Unexpected error saving rule.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="rule-grid">
        <button
          className="rule-btn"
          disabled={!safeFrom || busy === "nd_from"}
          onClick={() => run("nd_from", "from", safeFrom, "no_draft")}
        >
          {busy === "nd_from" ? "Saving…" : "No-draft sender"}
        </button>

        <button
          className="rule-btn"
          disabled={!safeSubject || busy === "nd_subj"}
          onClick={() => run("nd_subj", "subject_contains", safeSubject, "no_draft")}
        >
          {busy === "nd_subj" ? "Saving…" : "No-draft subject"}
        </button>

        <button
          className="rule-btn"
          disabled={!safeFrom || busy === "sk_from"}
          onClick={() => run("sk_from", "from", safeFrom, "skip")}
        >
          {busy === "sk_from" ? "Saving…" : "Skip sender"}
        </button>

        <button
          className="rule-btn"
          disabled={!safeSubject || busy === "sk_subj"}
          onClick={() => run("sk_subj", "subject_contains", safeSubject, "skip")}
        >
          {busy === "sk_subj" ? "Saving…" : "Skip subject"}
        </button>
      </div>

      {msg && <div className="rule-msg">{msg}</div>}
    </>
  );
}