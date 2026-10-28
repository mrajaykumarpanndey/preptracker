import { NextResponse } from "next/server";
import { GOOGLE_SCOPES, oauthClient, oauthConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// One-time sign-in: lets the app edit your sheet and add events to your calendar.
export function GET() {
  if (!oauthConfigured()) {
    return NextResponse.json({ error: "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first" }, { status: 400 });
  }
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: GOOGLE_SCOPES,
  });
  return NextResponse.redirect(url);
}
