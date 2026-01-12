import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getLocalNowMinutes(timeZone: string): number | null {
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
    return hour * 60 + minute;
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
  startMin: number | null;
  endMin: number | null;
  intervalMinutes: number;
  lastRunAtIso?: string | null;
}) {
  const { timezone, startMin, endMin, intervalMinutes, lastRunAtIso } = args;

  const nowMin = getLocalNowMinutes(timezone);

  // If we can't compute, give a safe relative estimate
  const mins = minutesSince(lastRunAtIso ?? null);
  if (nowMin == null || startMin == null || endMin == null) {
    if (mins >= intervalMinutes) return "Now";
    return `In ~${Math.ceil(intervalMinutes - mins)} min`;
  }

  if (nowMin < startMin) return `Today ${formatLocalTime(startMin)} (${timezone})`;
  if (nowMin > endMin) return `Tomorrow ${formatLocalTime(startMin)} (${timezone})`;

  if (mins >= intervalMinutes) return `Now (${timezone})`;
  return `In ~${Math.ceil(intervalMinutes - mins)} min (${timezone})`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
  if (!APP_URL) return res.status(500).json({ error: "NEXT_PUBLIC_APP_URL not configured" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase env vars not configured" });
  }

  const authHeader = (req.headers["authorization"] as string) || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (token !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: accounts, error: aErr } = await supabase
    .from("gmail_accounts")
    .select("id,email");

  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!accounts?.length) return res.json({ ok: true, accounts: 0, ran: 0, skipped: 0 });

  const { data: settings, error: sErr } = await supabase
    .from("agent_settings")
    .select(
      "gmail_account_id,enabled,run_mode,period_minutes,interval_minutes,timezone,window_start,window_end,last_run_at"
    );

  if (sErr) return res.status(500).json({ error: sErr.message });

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

  const preview: Array<{ gmail_account_id: string; email: string; next_run: string }> = [];

  for (const acc of accounts) {
    const s = settingsMap.get(acc.id);

    const enabled = s?.enabled ?? true;
    const runMode = s?.run_mode ?? "periodic";
    const intervalMinutes = s?.interval_minutes ?? s?.period_minutes ?? 60;
    const lastRunAt = s?.last_run_at ?? null;

    const timezone = s?.timezone ?? "America/New_York";
    const startMin = parseHHMMToMinutes(s?.window_start ?? "07:00:00");
    const endMin = parseHHMMToMinutes(s?.window_end ?? "21:00:00");

    preview.push({
      gmail_account_id: acc.id,
      email: acc.email,
      next_run: nextRunPreview({
        timezone,
        startMin,
        endMin,
        intervalMinutes,
        lastRunAtIso: lastRunAt,
      }),
    });

    if (!enabled) {
      skipped++;
      reasons.disabled++;
      continue;
    }
    if (runMode === "instant") {
      skipped++;
      reasons.instant_mode++;
      continue;
    }

    // window check (same-day only)
    const nowMin = getLocalNowMinutes(timezone);
    const windowOk =
      nowMin != null && startMin != null && endMin != null
        ? nowMin >= startMin && nowMin <= endMin
        : true;

    if (!windowOk) {
      skipped++;
      reasons.not_in_window++;
      continue;
    }

    // due check
    const mins = minutesSince(lastRunAt);
    if (mins < intervalMinutes) {
      skipped++;
      reasons.not_due++;
      continue;
    }

    // history: start
    const startedAt = new Date();
    const { data: runRow } = await supabase
      .from("agent_run_history")
      .insert({
        gmail_account_id: acc.id,
        triggered_by: "cron",
        status: "skipped",
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
      const r = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        cache: "no-store",
      });
      httpStatus = r.status;
      ok = r.ok;
      if (!ok) errorText = await r.text().catch(() => "unknown error");
    } catch (e: any) {
      ok = false;
      errorText = e?.message || String(e);
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    if (ok) {
      ran++;
      reasons.triage_ok++;

      await supabase
        .from("agent_settings")
        .upsert({ gmail_account_id: acc.id, last_run_at: finishedAt.toISOString() }, { onConflict: "gmail_account_id" });

      if (runId) {
        await supabase
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
      skipped++;
      reasons.triage_failed++;

      if (runId) {
        await supabase
          .from("agent_run_history")
          .update({
            status: "failed",
            finished_at: finishedAt.toISOString(),
            duration_ms: durationMs,
            http_status: httpStatus,
            error_text: errorText,
          })
          .eq("id", runId);
      }
    }
  }

  return res.json({
    ok: true,
    accounts: accounts.length,
    ran,
    skipped,
    reasons,
    next_run_preview: preview.slice(0, 100),
  });
}
