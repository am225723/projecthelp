"use client";

import { useMemo, useState } from "react";
import { RuleButtons } from "./RuleButtons";

type Priority = "low" | "normal" | "high" | null;

export type ActivityLog = {
  id: string;
  created_at: string;
  gmail_account_id: string;
  inbox_email: string | null;
  subject: string | null;
  from_address: string | null;
  summary: string | null;
  priority: Priority;
  draft_created: boolean | null;
};

type DraftFilter = "all" | "drafted" | "not_drafted";
type PriorityFilter = "all" | "high" | "normal" | "low";
type RangeFilter = "24h" | "7d" | "14d" | "30d" | "all";

function rangeCutoff(range: RangeFilter): number | null {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (range === "24h") return now - 24 * hour;
  if (range === "7d") return now - 7 * day;
  if (range === "14d") return now - 14 * day;
  if (range === "30d") return now - 30 * day;
  return null;
}

export default function ActivityClient({ logs }: { logs: ActivityLog[] }) {
  const [draft, setDraft] = useState<DraftFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [range, setRange] = useState<RangeFilter>("14d");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = rangeCutoff(range);

    return logs.filter((l) => {
      if (cutoff) {
        const t = new Date(l.created_at).getTime();
        if (Number.isFinite(t) && t < cutoff) return false;
      }

      if (draft === "drafted" && !l.draft_created) return false;
      if (draft === "not_drafted" && l.draft_created) return false;

      const p = (l.priority || "normal").toLowerCase() as "low" | "normal" | "high";
      if (priority !== "all" && p !== priority) return false;

      if (q) {
        const hay = [l.subject || "", l.from_address || "", l.summary || "", l.inbox_email || ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [logs, draft, priority, range, query]);

  const stats = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const scoped = cutoff ? logs.filter((l) => new Date(l.created_at).getTime() >= cutoff) : logs;

    return {
      total: scoped.length,
      drafted: scoped.filter((l) => l.draft_created).length,
      high: scoped.filter((l) => (l.priority || "normal") === "high").length,
    };
  }, [logs, range]);

  return (
    <section>
      <div className="toolbar">
        <div className="toolbar-stats">
          <span className="stat-pill">Total: {stats.total}</span>
          <span className="stat-pill success">Drafts: {stats.drafted}</span>
          <span className="stat-pill alert">High: {stats.high}</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={range} onChange={(e) => setRange(e.target.value as RangeFilter)} className="select">
            <option value="24h">Range: Last 24 hours</option>
            <option value="7d">Range: Last 7 days</option>
            <option value="14d">Range: Last 14 days</option>
            <option value="30d">Range: Last 30 days</option>
            <option value="all">Range: All</option>
          </select>

          <select value={draft} onChange={(e) => setDraft(e.target.value as DraftFilter)} className="select">
            <option value="all">Draft: All</option>
            <option value="drafted">Draft: Created</option>
            <option value="not_drafted">Draft: Not Created</option>
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value as PriorityFilter)} className="select">
            <option value="all">Priority: All</option>
            <option value="high">Priority: High</option>
            <option value="normal">Priority: Normal</option>
            <option value="low">Priority: Low</option>
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject / from / summary…"
            className="input"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="table-muted">No messages match your filters.</div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Inbox</th>
                  <th>Subject</th>
                  <th>From</th>
                  <th style={{ textAlign: "center" }}>Priority</th>
                  <th style={{ textAlign: "center" }}>Draft</th>
                  <th>Summary</th>
                  <th>Teach agent (future)</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((log) => {
                  const p = (log.priority || "normal").toLowerCase();
                  const priorityClass =
                    p === "high" ? "pill-high" : p === "low" ? "pill-low" : "pill-normal";
                  const draftClass = log.draft_created ? "pill-success" : "pill-low";

                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.inbox_email ?? "—"}</td>
                      <td>{log.subject ?? "(no subject)"}</td>
                      <td>{log.from_address ?? "—"}</td>
                      <td align="center">
                        <span className={`pill ${priorityClass}`}>{p}</span>
                      </td>
                      <td align="center">
                        <span className={`pill ${draftClass}`}>{log.draft_created ? "Created" : "—"}</span>
                      </td>
                      <td style={{ maxWidth: 520 }}>
                        <span className="item-summary">{log.summary ?? ""}</span>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <RuleButtons
                          gmailAccountId={log.gmail_account_id}
                          fromAddress={log.from_address ?? ""}
                          subject={log.subject ?? ""}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
