"use server";

import { redirect } from "next/navigation";
import { saveSettings } from "@/lib/settings";
import { createTrackerSheet, inspectSheet, setupSheet } from "@/lib/sheets";
import { formatLocal } from "@/lib/time";

function sheetIdFrom(input: string): string | null {
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(input);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(input) ? input : null;
}

const fail = (message: string): never => redirect(`/settings?error=${encodeURIComponent(message)}`);

export async function connectSheet(formData: FormData) {
  const sheetId = sheetIdFrom(String(formData.get("sheet") ?? "").trim());
  if (!sheetId) fail("That doesn't look like a Google Sheets link. Copy the full address from your browser.");

  let title = "";
  try {
    title = await inspectSheet(sheetId!);
  } catch {
    fail("Couldn't open that sheet. Make sure the Google account you connected owns it or has Editor access.");
  }
  saveSettings({ sheetId: sheetId!, sheetTitle: title });
  try {
    await setupSheet();
  } catch (error) {
    fail(`Sheet saved, but adding the Tracker/History tabs failed: ${error instanceof Error ? error.message : error}`);
  }
  redirect(`/settings?ok=${encodeURIComponent(`Connected "${title}".`)}`);
}

export async function createSheet() {
  let created: { id: string; title: string } | undefined;
  try {
    const tomorrowEvening = new Date(Date.now() + 86_400_000);
    created = await createTrackerSheet(`${formatLocal(tomorrowEvening).slice(0, 10)} 19:00`);
  } catch (error) {
    fail(`Couldn't create the sheet: ${error instanceof Error ? error.message : error}`);
  }
  saveSettings({ sheetId: created!.id, sheetTitle: created!.title });
  redirect(`/settings?ok=${encodeURIComponent(`Created "${created!.title}" in your Google Drive with an example row.`)}`);
}
