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
