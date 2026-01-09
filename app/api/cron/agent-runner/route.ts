// app/api/cron/agent-runner/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function minutesSince(dateIso?: string | null) {
  if (!dateIso) return Infinity;
  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60);
}

function parseHHMMToMinutes(value?: string | null): number | null {
  if (!value) return null; // "HH:MM:SS" or "HH:MM"
  const parts = value.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function getLocalNowParts(timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour, minute, nowMin: hour * 60 + minute };
  } catch {
    return null;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatLocalTime(mins: number) {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function nextRunPreview(args: {
  timezone: string;
  windowStartMin: number | null;
  windowEndMin: number | null;
  intervalMinutes: number;
  lastRunAtIso?: string | null;
}) {
  const { timezone, windowStartMin, windowEndMin, intervalMinutes, lastRunAtIso } = args;

  const local = getLocalNowParts(timezone);
  if (!local || windowStartMin == null || windowEndMin == null) {
    // if we can't compute, return a safe hint
    const mins = minutesSince(lastRunAtIso ?? null);
    if (mins >= intervalMinutes) return "Now";
    return `In ~${Math.ceil(intervalMinutes - mins)} min`;
  }

  // Same-day windows only
  if (local.nowMin < windowStartMin) {
    return `Today ${formatLocalTime(windowStartMin)} (${timezone})`;
  }
  if (local.nowMin > windowEndMin) {
    return `Tomorrow ${formatLocalTime(windowStartMin)} (${timezone})`;
  }

  const mins = minutesSince(lastRunAtIso ?? null);
  if (mins >= intervalMinutes) return `Now (${timezone})`;
  return `In ~${Math.ceil(intervalMinutes - mins)} min (${timezone})`;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!APP_URL) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load accounts
  const { data: accounts, error: aErr } = await supabaseServer
    .from("gmail_accounts")
    .select("id,email");

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (!accounts?.length) {
    return NextResponse.json({ ok: true, accounts: 0, ran: 0, skipped: 0 });
  }

  // Load settings
  const { data: settings, error: sErr } = await supabaseServer
    .from("agent_settings")
    .select(
      [
        "gmail_account_id",
        "enabled",
        "run_mode",
        "period_minutes",
        "interval_minutes",
        "timezone",
        "window_start",
        "window_end",
        "last_run_at",
      ].join(",")
    );

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const settingsMap = new Map<string, any>();
  (settings || []).forEach((s: any) => settingsMap.set(s.gmail_account_id, s));

  let ran = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {
    disabled: 0,
    instant_mode: 0,
    not_in_window: 0,
    not_due: 0,
    triage_failed: 0,
    triage_ok: 0,
  };

  const next_run_preview: Array<{ gmail_account_id: string; email: string; next_run: string }> = [];

  for (const acc of accounts) {
    const s = settingsMap.get(acc.id);

    const enabled = s?.enabled ?? true;
    const runMode = s?.run_mode ?? "periodic";
    const intervalMinutes = s?.interval_minutes ?? s?.period_minutes ?? 60;
    const lastRunAt = s?.last_run_at ?? null;

    const timezone = s?.timezone ?? "America/New_York";
    const windowStartStr = s?.window_start ?? "07:00:00";
    const windowEndStr = s?.window_end ?? "21:00:00";

    const startMin = parseHHMMToMinutes(windowStartStr);
    const endMin = parseHHMMToMinutes(windowEndStr);
    const local = getLocalNowParts(timezone);

    const windowOk =
      local && startMin != null && endMin != null ? local.nowMin >= startMin && local.nowMin <= endMin : true;

    next_run_preview.push({
      gmail_account_id: acc.id,
      email: acc.email,
      next_run: nextRunPreview({
        timezone,
        windowStartMin: startMin,
        windowEndMin: endMin,
        intervalMinutes,
        lastRunAtIso: lastRunAt,
      }),
    });

    if (!enabled) {
      skipped += 1;
      reasons.disabled += 1;
      continue;
    }

    if (runMode === "instant") {
      skipped += 1;
      reasons.instant_mode += 1;
      continue;
    }

    if (!windowOk) {
      skipped += 1;
      reasons.not_in_window += 1;
      continue;
    }

    const mins = minutesSince(lastRunAt);
    if (mins < intervalMinutes) {
      skipped += 1;
      reasons.not_due += 1;
      continue;
    }

    // Create run history row
    const startedAt = new Date();
    const { data: runRow } = await supabaseServer
      .from("agent_run_history")
      .insert({
        gmail_account_id: acc.id,
        triggered_by: "cron",
        status: "skipped", // will update
        started_at: startedAt.toISOString(),
        lookback_days: 14,
      })
      .select("id")
      .single();

    const runId: string | undefined = runRow?.id;

    const url = `${APP_URL}/api/jobs/run-triage?lookbackDays=14&gmailAccountId=${encodeURIComponent(acc.id)}`;

    let ok = false;
    let httpStatus: number | null = null;
    let errorText: string | null = null;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        cache: "no-store",
      });

      httpStatus = res.status;
      ok = res.ok;

      if (!ok) {
        errorText = await res.text().catch(() => "unknown error");
        console.error("Cron triage failed:", acc.email, res.status, errorText);
      }
    } catch (e: any) {
      ok = false;
      errorText = e?.message || String(e);
      console.error("Cron triage fetch error:", acc.email, errorText);
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    if (ok) {
      ran += 1;
      reasons.triage_ok += 1;

      await supabaseServer
        .from("agent_settings")
        .upsert({ gmail_account_id: acc.id, last_run_at: finishedAt.toISOString() }, { onConflict: "gmail_account_id" });

      if (runId) {
        await supabaseServer
          .from("agent_run_history")
          .update({
            status: "success",
            finished_at: finishedAt.toISOString(),
            duration_ms: durationMs,
            http_status: httpStatus,
            error_text: null,
          })
          .eq("id", runId);
      }
    } else {
      skipped += 1;
      reasons.triage_failed += 1;

      if (runId) {
        await supabaseServer
          .from("agent_run_history")
          .update({
            status: "failed",
            finished_at: finishedAt.toISOString(),
            duration
