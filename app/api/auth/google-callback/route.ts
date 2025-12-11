export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, upsertGmailAccountFromTokens } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Missing code", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertGmailAccountFromTokens(tokens);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (e: any) {
    console.error("OAuth callback error", e);
    return new NextResponse("Failed to connect Gmail", { status: 500 });
  }
}
