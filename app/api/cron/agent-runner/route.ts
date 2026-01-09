// app/api/cron/agent-runner/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// IMPORTANT: set this in Vercel env vars to your production URL
// e.g. https://projecthelp.vercel.app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function minutesSince(dateIso?: string | null) {
  if (!dateIso) return Infinity;
  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60);
}

function parseHHMMToMinutes(value?: string | null): number | null {
  if (!value) return null;

  // Supabase "time" can come back as "HH:MM:SS" or "HH:MM"
  const parts = value.split(":");
  if (parts.length < 2) return null;

  const hh = Number(parts[0]);
  const mm = Number(parts[1]);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return hh * 60 + mm;
}

function getLocalMinutesNow(timeZone: string): number | null {
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
    // Invalid timezone string, etc.
    return null;
  }
}

function isWithinSameDayWindow(
  nowMin: number,
  startMin: number,
  endMin: number
): boolean {
  // User said no overnight windows needed, so we assume start <= end
  return nowMin >= startMin && nowMin <= endMin;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (!APP_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not configured" },
      { status: 500 }
    );
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
  if (!accounts?.length)
    return NextResponse.json({ ok: true, accounts: 0, ran: 0, skipped: 0 });

  // Load settings (extended to include schedule columns if present)
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
  };

  for (const acc of accounts) {
    const s = settingsMap.get(acc.id);

    // Defaults if no settings row exists
    const enabled = s?.enabled ?? true;
    const runMode = s?.run_mode ?? "periodic";

    // Backwards-compat: if interval_minutes exists use it, else use period_minutes, else 60
    const intervalMinutes = s?.interval_minutes ?? s?.period_minutes ?? 60;

    const lastRunAt = s?.last_run_at ?? null;

    // Schedule defaults (user-configurable hours)
    const timezone = s?.timezone ?? "America/New_York";
    const windowStartStr = s?.window_start ?? "07:00:00";
    const windowEndStr = s?.window_end ?? "21:00:00";

    if (!enabled) {
      skipped += 1;
      reasons.disabled += 1;
      continue;
    }

    // Instant mode not implemented yet (needs Gmail push). For now, we don't cron-run it.
    if (runMode === "instant") {
      skipped += 1;
      reasons.instant_mode += 1;
      continue;
    }

    // Time window check (same-day only)
    const nowLocalMin = getLocalMinutesNow(timezone);
    const startMin = parseHHMMToMinutes(windowStartStr);
    const endMin = parseHHMMToMinutes(windowEndStr);

    // If timezone/window parsing fails for any reason, fall back to "always allowed"
    const windowOk =
      nowLocalMin != null && startMin != null && endMin != null
        ? isWithinSameDayWindow(nowLocalMin, startMin, endMin)
        : true;

    if (!windowOk) {
      skipped += 1;
      reasons.not_in_window += 1;
      continue;
    }

    // Periodic: run only if due
    const mins = minutesSince(lastRunAt);
    if (mins < intervalMinutes) {
      skipped += 1;
      reasons.not_due += 1;
      continue;
    }

    // Call your existing triage endpoint in the same deployment
    // If your triage endpoint supports scoping, this param helps; if not, it’s harmless.
    const url = `${APP_URL}/api/jobs/run-triage?lookbackDays=14&gmailAccountId=${encodeURIComponent(
      acc.id
    )}`;

    let ok = false;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        cache: "no-store",
      });

      ok = res.ok;

      if (!ok) {
        const txt = await res.text().catch(() => "");
        console.error("Cron triage failed:", acc.email, res.status, txt);
      }
    } catch (e: any) {
      console.error("Cron triage fetch error:", acc.email, e?.message || e);
      ok = false;
    }

    if (ok) {
      ran += 1;

      // Update last_run_at for this account
      await supabaseServer
        .from("agent_settings")
        .upsert(
          { gmail_account_id: acc.id, last_run_at: new Date().toISOString() },
          { onConflict: "gmail_account_id" }
        );
    } else {
      skipped += 1;
      reasons.triage_failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    ran,
    skipped,
    reasons,
  });
}
