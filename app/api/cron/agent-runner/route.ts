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
  return (Date.now() - t) / (30 7,9,11,13,15,17,19 * * *);
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

  // Load accounts + settings
  const { data: accounts, error: aErr } = await supabaseServer
    .from("gmail_accounts")
    .select("id,email");

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (!accounts?.length) return NextResponse.json({ ok: true, accounts: 0, ran: 0 });

  const { data: settings, error: sErr } = await supabaseServer
    .from("agent_settings")
    .select("gmail_account_id,enabled,run_mode,period_minutes,last_run_at");

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const settingsMap = new Map<string, any>();
  (settings || []).forEach((s: any) => settingsMap.set(s.gmail_account_id, s));

  let ran = 0;
  let skipped = 0;

  for (const acc of accounts) {
    const s = settingsMap.get(acc.id);

    // Default behavior if no settings row exists: periodic hourly enabled
    const enabled = s?.enabled ?? true;
    const runMode = s?.run_mode ?? "periodic";
    const periodMinutes = s?.period_minutes ?? 60;
    const lastRunAt = s?.last_run_at ?? null;

    if (!enabled) {
      skipped += 1;
      continue;
    }

    // Instant mode not implemented yet (needs Gmail push). For now, we don't cron-run it.
    if (runMode === "instant") {
      skipped += 1;
      continue;
    }

    // Periodic: run only if due
    const mins = minutesSince(lastRunAt);
    if (mins < periodMinutes) {
      skipped += 1;
      continue;
    }

    // Call your existing triage endpoint in the same deployment
    // lookbackDays can stay 14 by default, or adjust here
    const url = `${APP_URL}/api/jobs/run-triage?lookbackDays=14`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      cache: "no-store",
    });

    if (res.ok) {
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
      const txt = await res.text().catch(() => "");
      console.error("Cron triage failed:", acc.email, res.status, txt);
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    ran,
    skipped,
  });
}
