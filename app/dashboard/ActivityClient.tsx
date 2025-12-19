"use client";

import { useMemo, useState } from "react";

type Priority = "low" | "normal" | "high" | null;

export type ActivityLog = {
  id: string;
  created_at: string;
  inbox_email: string | null;
  subject: string | null;
  from_address: string | null;
  summary: string | null;
  priority: Priority;
  draft_created: boolean | null;
};

type DraftFilter = "all" | "drafted" | "not_drafted";
type PriorityFilter = "all" | "high" | "normal" | "low";

function pillStyle(bg: string, border: string, color: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: "0.8rem",
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  };
}

export default function ActivityClient({ logs }: { logs: ActivityLog[] }) {
  const [draft, setDraft] = useState<DraftFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return logs.filter((l) => {
      if (draft === "drafted" && !l.draft_created) return false;
      if (draft === "not_drafted" && l.draft_created) return false;

      const p = (l.priority || "normal").toLowerCase() as "low" | "normal" | "high";
      if (priority !== "all" && p !== priority) return false;

      if (q) {
        const hay = [
          l.subject || "",
          l.from_address || "",
          l.summary || "",
          l.inbox_email || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [logs, draft, priority, query]);

  const stats = useMemo(() => {
    const total = logs.length;
    const drafted = logs.filter((l) => l.draft_created).length;
    const high = logs.filter((l) => (l.priority || "normal") === "high").length;
    return { total, drafted, high };
  }, [logs]);

  return (
    <section
      style={{
        border: "1px solid #1f2937",
        borderRadius: "0.9rem",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: "14px 14px 12px",
          borderBottom: "1px solid #1f2937",
          background: "#020617",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle("rgba(148,163,184,0.10)", "rgba(148,163,184,0.25)", "rgba(226,232,240,0.95)")}>
            Total: {stats.total}
          </span>
          <span style={pillStyle("rgba(16,185,129,0.12)", "rgba(16,185,129,0.35)", "rgba(167,243,208,0.95)")}>
            Drafts: {stats.drafted}
          </span>
          <span style={pillStyle("rgba(244,63,94,0.10)", "rgba(244,63,94,0.30)", "rgba(254,202,202,0.95)")}>
            High: {stats.high}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value as DraftFilter)}
            style={{
              padding: "10px 12px",
              borderRadius: "0.65rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.25)",
              color: "rgba(226,232,240,0.95)",
              outline: "none",
            }}
          >
            <option value="all">Draft: All</option>
            <option value="drafted">Draft: Created</option>
            <option value="not_drafted">Draft: Not Created</option>
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as PriorityFilter)}
            style={{
              padding: "10px 12px",
              borderRadius: "0.65rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.25)",
              color: "rgba(226,232,240,0.95)",
              outline: "none",
            }}
          >
            <option value="all">Priority: All</option>
            <option value="high">Priority: High</option>
            <option value="normal">Priority: Normal</option>
            <option value="low">Priority: Low</option>
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject / from / summary…"
            style={{
              width: 320,
              maxWidth: "100%",
              padding: "10px 12px",
              borderRadius: "0.65rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.25)",
              color: "rgba(226,232,240,0.95)",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: 16, color: "#9ca3af" }}>
          No messages match your filters.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#020617" }}>
                <th align="left" style={{ padding: "10px 12px" }}>When</th>
                <th align="left" style={{ padding: "10px 12px" }}>Inbox</th>
                <th align="left" style={{ padding: "10px 12px" }}>Subject</th>
                <th align="left" style={{ padding: "10px 12px" }}>From</th>
                <th align="center" style={{ padding: "10px 12px" }}>Priority</th>
                <th align="center" style={{ padding: "10px 12px" }}>Draft</th>
                <th align="left" style={{ padding: "10px 12px" }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const p = (log.priority || "normal").toLowerCase();
                const pPill =
                  p === "high"
                    ? pillStyle("rgba(244,63,94,0.10)", "rgba(244,63,94,0.30)", "rgba(254,202,202,0.95)")
                    : p === "low"
                    ? pillStyle("rgba(148,163,184,0.08)", "rgba(148,163,184,0.22)", "rgba(226,232,240,0.85)")
                    : pillStyle("rgba(99,102,241,0.10)", "rgba(99,102,241,0.28)", "rgba(199,210,254,0.95)");

                const dPill = log.draft_created
                  ? pillStyle("rgba(16,185,129,0.12)", "rgba(16,185,129,0.35)", "rgba(167,243,208,0.95)")
                  : pillStyle("rgba(148,163,184,0.08)", "rgba(148,163,184,0.22)", "rgba(226,232,240,0.85)");

                return (
                  <tr key={log.id} style={{ borderTop: "1px solid #1f2937" }}>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{log.inbox_email ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{log.subject ?? "(no subject)"}</td>
                    <td style={{ padding: "10px 12px" }}>{log.from_address ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }} align="center">
                      <span style={pPill}>{p}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }} align="center">
                      <span style={dPill}>{log.draft_created ? "Created" : "—"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", maxWidth: 520 }}>
                      <span style={{ whiteSpace: "pre-wrap", display: "inline-block" }}>
                        {log.summary ?? ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
