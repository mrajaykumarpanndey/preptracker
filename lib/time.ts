import { config } from "./config";

// The server may run in UTC (Vercel), so sheet times are interpreted with TZ_OFFSET explicitly.

function offsetMinutes(): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(config.tzOffset);
  if (!match) throw new Error(`TZ_OFFSET must look like +05:30, got "${config.tzOffset}"`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Parses "2026-11-02 18:30" (or just "2026-11-02", meaning 19:00) in the configured offset. */
export function parseLocal(text: string): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text.trim());
  if (!match) return null;
  const [, y, mo, d, h = "19", mi = "0"] = match;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi) - offsetMinutes() * 60_000;
  return new Date(utc);
}

function shifted(date: Date): Date {
  return new Date(date.getTime() + offsetMinutes() * 60_000);
}

/** Formats as "2026-11-02 18:30" in the configured offset - the same format parseLocal reads. */
export function formatLocal(date: Date): string {
  const l = shifted(date);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())} ${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}`;
}

export function localDay(date: Date): string {
  return formatLocal(date).slice(0, 10);
}

export function localHour(date: Date): number {
  return shifted(date).getUTCHours();
}

// ---------- Friendly labels for people (storage keeps "YYYY-MM-DD HH:mm") ----------

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** 20.5 -> "8:30 PM"; hours past midnight (e.g. 25 = 1 AM) wrap around. */
export function timeLabel(hours: number): string {
  const total = Math.round(hours * 60);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h24 % 12 || 12}:${pad(m)} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "8:00 - 8:30 PM", or "11:30 PM - 12:00 AM" when the period changes. */
export function timeRange(start: number, end: number): string {
  const a = timeLabel(start);
  const b = timeLabel(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} - ${b}` : `${a} - ${b}`;
}

/** "2026-10-29" -> "Thu, 29 Oct" (or "Thursday, 29 Oct" with long). */
export function dayLabel(day: string, long = false): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return `${(long ? WEEKDAY_LONG : WEEKDAY).format(d)}, ${DAY_MONTH.format(d)}`;
}

/** "2026-10-29 23:00" (or a Date) -> "Thu, 29 Oct · 11:00 PM". */
export function friendly(when: string | Date): string {
  const local = typeof when === "string" ? when : formatLocal(when);
  const [h, m] = local.slice(11, 16).split(":").map(Number);
  return local.length >= 16 ? `${dayLabel(local)} · ${timeLabel(h + m / 60)}` : dayLabel(local);
}
