import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { oauthClient } from "@/lib/google";

export const dynamic = "force-dynamic";

function saveToEnvFile(token: string): boolean {
  const file = ".env.local";
  if (process.env.NODE_ENV !== "development" || !existsSync(file)) return false;
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  const env = readFileSync(file, "utf8");
  writeFileSync(file, /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line) : `${env.trimEnd()}\n${line}\n`);
  return true;
}

const page = (body: string) =>
  new NextResponse(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font:15px system-ui;max-width:640px;margin:40px auto;padding:0 16px">${body}</body>`, {
    headers: { "Content-Type": "text/html" },
  });

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return page(`<p>Google sign-in was cancelled: ${req.nextUrl.searchParams.get("error") ?? "no code"}</p>`);

  const { tokens } = await oauthClient().getToken(code);
  if (!tokens.refresh_token) {
    return page("<p>Google didn't return a refresh token. Remove the app's access at myaccount.google.com/permissions and try again.</p>");
  }
  if (saveToEnvFile(tokens.refresh_token)) {
    return page("<h2>Google connected</h2><p>Saved to .env.local. <b>Restart <code>npm run dev</code></b>, then open the <a href=\"/\">tracker</a>.</p>");
  }
  return page(
    `<h2>Google connected</h2><p>Add this as the <code>GOOGLE_REFRESH_TOKEN</code> environment variable, then redeploy:</p><textarea readonly style="width:100%;height:80px">${tokens.refresh_token}</textarea>`,
  );
}
