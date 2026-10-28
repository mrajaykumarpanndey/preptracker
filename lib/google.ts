import { JWT, OAuth2Client } from "google-auth-library";
import { config } from "./config";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
];

export const oauthRedirectUri = () => `${config.appUrl}/api/google/callback`;

export function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/** True when the app acts as your Google account (OAuth), which also enables Google Calendar events. */
export function oauthConnected(): boolean {
  return oauthConfigured() && Boolean(process.env.GOOGLE_REFRESH_TOKEN);
}

export function oauthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: oauthRedirectUri(),
  });
}

let client: OAuth2Client | JWT | undefined;

function authClient(): OAuth2Client | JWT {
  if (client) return client;
  if (oauthConnected()) {
    const oauth = oauthClient();
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    client = oauth;
  } else if (oauthConfigured()) {
    throw new Error(`Google isn't connected yet. Open ${config.appUrl}/api/google/auth to sign in.`);
  } else {
    // Fallback: service account (the sheet must be shared with its email).
    client = new JWT({ email: config.googleEmail, key: config.googleKey, scopes: GOOGLE_SCOPES });
  }
  return client;
}

export async function googleRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: unknown,
): Promise<T> {
  const res = await authClient().request<T>({ url, method, data });
  return res.data;
}
