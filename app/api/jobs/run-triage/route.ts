// app/api/jobs/run-triage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runTriage, DEFAULT_LOOKBACK_DAYS } from "@/lib/triage-service";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Optional: allow manual runs without CRON_SECRET in local dev
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (CRON_SECRET && token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // lookbackDays param (defaults 14)
  const url = new URL(req.url);
  const lookbackDays =
    Number(url.searchParams.get("lookbackDays")) || DEFAULT_LOOKBACK_DAYS;

  const result = await runTriage(lookbackDays);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
