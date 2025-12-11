export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const url = generateAuthUrl("connect-gmail");
  return NextResponse.redirect(url);
}
