// app/api/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  gmail_account_id: string;
  rule_type: "from" | "subject_contains";
  pattern: string;
  action?: "skip" | "no_draft";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Body>;

    const gmail_account_id = body.gmail_account_id;
    const rule_type = body.rule_type;
    const pattern = (body.pattern || "").trim();
    const action = body.action || "skip";

    if (!gmail_account_id || !rule_type || !pattern) {
      return NextResponse.json(
        { error: "gmail_account_id, rule_type, and pattern are required" },
        { status: 400 }
      );
    }

    if (rule_type !== "from" && rule_type !== "subject_contains") {
      return NextResponse.json(
        { error: "rule_type must be 'from' or 'subject_contains'" },
        { status: 400 }
      );
    }

    if (action !== "skip" && action !== "no_draft") {
      return NextResponse.json(
        { error: "action must be 'skip' or 'no_draft'" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("triage_rules")
      .insert({
        gmail_account_id,
        rule_type,
        pattern,
        action,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting triage_rule", error);
      return NextResponse.json(
        { error: "Failed to create rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rule: data });
  } catch (err) {
    console.error("Error in /api/rules POST", err);
    return NextResponse.json(
      { error: "Internal error creating rule" },
      { status: 500 }
    );
  }
}
