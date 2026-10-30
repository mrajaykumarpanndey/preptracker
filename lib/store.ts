import { config } from "./config";
import {
  appendExcelHistory,
  excelExists,
  listExcelHistory,
  listExcelRows,
  listExcelStudy,
  listExcelWeeks,
  updateExcelRows,
  upsertExcelStudy,
  type StudySession,
  type WeekLog,
} from "./excel";
import * as sheets from "./sheets";
import type { Field, HistoryEntry, Row, RowUpdate } from "./sheets";

export type { Field, HistoryEntry, Row, RowUpdate, StudySession, WeekLog };

// Where the tracker data lives: a local Excel file (default when it exists) or a Google Sheet.
export type DataSource = "excel" | "google";

export function dataSource(): DataSource {
  const chosen = process.env.DATA_SOURCE;
  if (chosen === "excel" || chosen === "google") return chosen;
  return excelExists() ? "excel" : "google";
}

export function hasData(): boolean {
  return dataSource() === "excel" ? excelExists() : config.hasSheet;
}

export function listRows(): Promise<Row[]> {
  return dataSource() === "excel" ? listExcelRows() : sheets.listRows();
}

export async function getRow(rowNumber: number): Promise<Row | undefined> {
  return (await listRows()).find((row) => row.row === rowNumber);
}

export function updateRows(updates: RowUpdate[]): Promise<void> {
  if (updates.length === 0) return Promise.resolve();
  return dataSource() === "excel" ? updateExcelRows(updates) : sheets.updateRows(updates);
}

export function updateRow(row: number, fields: Partial<Record<Field, string>>): Promise<void> {
  return updateRows([{ row, fields }]);
}

export function listHistory(): Promise<HistoryEntry[]> {
  return dataSource() === "excel" ? listExcelHistory() : sheets.listHistory();
}

/** Study hours per week (Excel "Weekly Log" sheet only). */
export function listWeeks(): Promise<WeekLog[]> {
  return dataSource() === "excel" ? listExcelWeeks() : Promise.resolve([]);
}

/** Reading sessions from the Study Log (Excel tracker only). */
export function listStudy(): Promise<StudySession[]> {
  return dataSource() === "excel" ? listExcelStudy() : Promise.resolve([]);
}

export function recordStudy(entry: StudySession): Promise<void> {
  return dataSource() === "excel" ? upsertExcelStudy(entry) : Promise.resolve();
}

export function appendHistory(values: string[]): Promise<void> {
  return dataSource() === "excel" ? appendExcelHistory(values) : sheets.appendHistory(values);
}

export type Attempts = { count: number; best: number; last: number };

/** Quiz attempts per topic, from the history (oldest to newest). */
export function attemptsByTopic(history: HistoryEntry[]): Map<string, Attempts> {
  const byTopic = new Map<string, Attempts>();
  for (const h of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = byTopic.get(h.topic) ?? { count: 0, best: 0, last: 0 };
    byTopic.set(h.topic, { count: a.count + 1, best: Math.max(a.best, h.score), last: h.score });
  }
  return byTopic;
}
