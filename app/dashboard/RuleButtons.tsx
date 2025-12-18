"use client";

import { useState } from "react";

type Props = {
  gmailAccountId: string;
  fromAddress: string;
  subject: string;
};

async function postRule(payload: {
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
  const data = await res.json();
  return { ok: res.ok, data };
}

export function RuleButtons({ gmailAccountId, fromAddress, subject }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const hasFrom = fromAddress.trim().length > 0;
  const hasSubject = subject.trim().length > 0;

  const run = async (
    key: string,
    rule_type: "from" | "subject_contains",
    pattern: string,
    action: "skip" | "no_draft"
  ) => {
    setLoadingKey(key);
    setStatus(null);

    try {
      const { ok, data } = await postRule({
        gmail_account_id: gmailAccountId,
        rule_type,
        pattern,
        action,
      });

      if (!ok) {
        setStatus(data?.error ? `Error: ${data.error}` : "Failed to create rule.");
        return;
      }

      if (action === "skip") {
        setStatus("Saved: future matches will be skipped completely.");
      } else {
        setStatus("Saved: future matches will be triaged, but no draft will be created.");
      }
    } catch (e) {
      console.error(e);
      setStatus("Unexpected error creating rule.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!hasFrom || loadingKey === "skip_from"}
          onClick={() => run("skip_from", "from", fromAddress.trim(), "skip")}
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          Skip sender
        </button>

        <button
          disabled={!hasFrom || loadingKey === "nodraft_from"}
          onClick={() => run("nodraft_from", "from", fromAddress.trim(), "no_draft")}
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          No-draft sender
        </button>

        <button
          disabled={!hasSubject || loadingKey === "skip_subject"}
          onClick={() => run("skip_subject", "subject_contains", subject.trim(), "skip")}
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          Skip subject
        </button>

        <button
          disabled={!hasSubject || loadingKey === "nodraft_subject"}
          onClick={() =>
            run("nodraft_subject", "subject_contains", subject.trim(), "no_draft")
          }
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          No-draft subject
        </button>
      </div>

      {status && <div className="text-[11px] text-white/70">{status}</div>}
    </div>
  );
}
