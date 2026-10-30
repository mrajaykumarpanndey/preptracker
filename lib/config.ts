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
  get quizMinutes() { return number("QUIZ_MINUTES", 20); },
  // Working hours: study is planned around them. Days are 0 = Sunday ... 6 = Saturday.
  get officeDays() {
    return (process.env.OFFICE_DAYS ?? "1,2,3,4,5").split(",").map((d) => Number(d.trim())).filter((d) => d >= 0 && d <= 6);
  },
  get officeStartHour() { return number("OFFICE_START_HOUR", 10); },
  get officeEndHour() { return number("OFFICE_END_HOUR", 19); },
  // Sleep: from SLEEP_START_HOUR (after midnight, e.g. 4 = 04:00) until WAKE_HOUR.
  get sleepStartHour() { return number("SLEEP_START_HOUR", 4); },
  get wakeHour() { return number("WAKE_HOUR", 9); },
};
