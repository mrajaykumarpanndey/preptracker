import { readSettings } from "./settings";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

function number(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" ? value : fallback;
}

// Read lazily so a missing value fails the request that needs it, not the build.
export const config = {
  get sheetId() {
    const id = readSettings().sheetId || process.env.SHEET_ID;
    if (!id) throw new Error("No Google Sheet added yet. Add one on the Settings page.");
    return id;
  },
  get hasSheet() { return Boolean(readSettings().sheetId || process.env.SHEET_ID); },
  get tab() { return process.env.SHEET_TAB || "Tracker"; },
  historyTab: "History",
  get googleEmail() { return required("GOOGLE_CLIENT_EMAIL"); },
  get googleKey() { return required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"); },

  get notifyEmail() { return required("NOTIFY_EMAIL"); },
  get mailFrom() { return process.env.MAIL_FROM || required("SMTP_USER"); },
  get smtp() {
    const port = number("SMTP_PORT", 465);
    return {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: required("SMTP_USER"), pass: required("SMTP_PASS") },
    };
  },

  get appUrl() { return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""); },
  // Times in the sheet are read in this offset, e.g. "+05:30" for India.
  get tzOffset() { return process.env.TZ_OFFSET || "+05:30"; },
  get passScore() { return number("PASS_SCORE", 7); },
  get retryDays() { return number("RETRY_DAYS", 3); },
  get inviteHoursBefore() { return number("INVITE_HOURS_BEFORE", 24); },
  get remindHoursBefore() { return number("REMIND_HOURS_BEFORE", 24); },
  get digestHour() { return number("DIGEST_HOUR", 9); },
  get interviewMinutes() { return number("INTERVIEW_MINUTES", 30); },
};
