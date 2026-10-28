import { config } from "./config";
import {
  appendExcelHistory,
  excelExists,
  listExcelHistory,
  listExcelRows,
  listExcelWeeks,
  updateExcelRows,
  type WeekLog,
} from "./excel";
import * as sheets from "./sheets";
import type { Field, HistoryEntry, Row, RowUpdate } from "./sheets";

export type { Field, HistoryEntry, Row, RowUpdate, WeekLog };

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

export function appendHistory(values: string[]): Promise<void> {
  return dataSource() === "excel" ? appendExcelHistory(values) : sheets.appendHistory(values);
}
