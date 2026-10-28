import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Settings changed from the portal. Stored in a local file, so on a read-only host (Vercel)
// set the equivalent environment variable (e.g. SHEET_ID) instead.
const FILE = path.join(process.cwd(), "data", "settings.json");

export type Settings = { sheetId?: string; sheetTitle?: string };

export function readSettings(): Settings {
  try {
    return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch: Settings): void {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ ...readSettings(), ...patch }, null, 2));
}
