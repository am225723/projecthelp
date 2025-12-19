// app/api/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RuleType = "skip_sender" | "skip_subject";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      gmailAccountId?: string;
      type?: RuleType;
      pattern?: string;
    };

    const gmailAccountId = body.gmailAccountId?.trim();
    const type = body.type;
    const pattern = body.pattern?.trim();

    if (!gmailAccountId || !type || !pattern) {
      return NextResponse.json(
        { error: "gmailAccountId, type, and pattern are required" },
        { status: 400 }
      );
    }

    if (type !== "skip_sender" && type !== "skip_subject") {
      return NextResponse.json({ error: "Invalid rule type" }, { status: 400 });
    }

    const { error } = await supabaseServer.from("agent_rules").insert({
      gmail_account_id: gmailAccountId,
      rule_type: type,
      pattern,
      is_enabled: true,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create rule", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Bad request", details: e?.message || String(e) },
      { status: 400 }
    );
  }
}