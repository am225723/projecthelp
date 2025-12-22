// app/api/settings/agent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RunMode = "periodic" | "instant";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      gmailAccountId?: string;
      enabled?: boolean;
      runMode?: RunMode;
      periodMinutes?: number;
    };

    const gmailAccountId = body.gmailAccountId?.trim();
    if (!gmailAccountId) {
      return NextResponse.json({ error: "gmailAccountId required" }, { status: 400 });
    }

    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
    const runMode: RunMode =
      body.runMode === "instant" || body.runMode === "periodic" ? body.runMode : "periodic";

    const periodMinutes =
      typeof body.periodMinutes === "number" && Number.isFinite(body.periodMinutes)
        ? Math.max(5, Math.floor(body.periodMinutes))
        : 60;

    const { error } = await supabaseServer.from("agent_settings").upsert(
      {
        gmail_account_id: gmailAccountId,
        enabled,
        run_mode: runMode,
        period_minutes: periodMinutes,
      },
      { onConflict: "gmail_account_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Bad request" },
      { status: 400 }
    );
  }
}
