"use client";

import { useMemo, useState } from "react";

type Priority = "all" | "high" | "normal" | "low";
type DraftFilter = "all" | "drafted" | "not_drafted";

export function Filters({
  children,
}: {
  children: (filters: {
    draft: DraftFilter;
    priority: Priority;
    query: string;
  }) => React.ReactNode;
}) {
  const [draft, setDraft] = useState<DraftFilter>("all");
  const [priority, setPriority] = useState<Priority>("all");
  const [query, setQuery] = useState("");

  const filters = useMemo(
    () => ({ draft, priority, query }),
    [draft, priority, query]
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <div className="pill">Filters</div>

        <select
          className="btn"
          value={draft}
          onChange={(e) => setDraft(e.target.value as DraftFilter)}
          style={{ padding: "10px 12px" }}
        >
          <option value="all">Draft: All</option>
          <option value="drafted">Draft: Created</option>
          <option value="not_drafted">Draft: Not created</option>
        </select>

        <select
          className="btn"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          style={{ padding: "10px 12px" }}
        >
          <option value="all">Priority: All</option>
          <option value="high">Priority: High</option>
          <option value="normal">Priority: Normal</option>
          <option value="low">Priority: Low</option>
        </select>

        <input
          className="btn"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject / from / summary…"
          style={{ width: 320, maxWidth: "100%" }}
        />
      </div>

      {children(filters)}
    </>
  );
}
