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
          ? "Saved: future matches will be triaged, but no draft will be created."
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
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!safeFrom || busy === "nodraft_from"}
          onClick={() => run("nodraft_from", "from", safeFrom, "no_draft")}
          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "nodraft_from" ? "Saving…" : "No-draft sender"}
        </button>

        <button
          disabled={!safeSubject || busy === "nodraft_subj"}
          onClick={() => run("nodraft_subj", "subject_contains", safeSubject, "no_draft")}
          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "nodraft_subj" ? "Saving…" : "No-draft subject"}
        </button>

        <button
          disabled={!safeFrom || busy === "skip_from"}
          onClick={() => run("skip_from", "from", safeFrom, "skip")}
          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "skip_from" ? "Saving…" : "Skip sender"}
        </button>

        <button
          disabled={!safeSubject || busy === "skip_subj"}
          onClick={() => run("skip_subj", "subject_contains", safeSubject, "skip")}
          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "skip_subj" ? "Saving…" : "Skip subject"}
        </button>
      </div>

      {msg && (
        <div className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/70 ring-1 ring-white/10">
          {msg}
        </div>
      )}
    </div>
  );
}