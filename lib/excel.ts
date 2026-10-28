import ExcelJS from "exceljs";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { STATUS } from "./constants";
import type { Field, HistoryEntry, Row, RowUpdate } from "./sheets";
import { localDay } from "./time";

// Works with the ML_Learning_Tracker.xlsx layout:
//   Roadmap!B2 = start date, rows 7+ = phases (A code, B focus, C planned weeks)
//   Topic Tracker: A # | B Category | C Topic | D Phase | E Priority | F Status | G Hours | H Date Completed | I Notes
// The app adds columns J-O and an "Interview History" sheet the first time it writes.

const TOPICS = "Topic Tracker";
const ROADMAP = "Roadmap";
const HISTORY = "Interview History";
const WEEKLY_LOG = "Weekly Log";
const DUE_TIME = "19:00";
const STATUS_LIST = [STATUS.NOT_STARTED, STATUS.IN_PROGRESS, STATUS.READY, STATUS.NEEDS_WORK, STATUS.DONE];

const EXTRA_COLUMNS = [
  { header: "Target Date (optional)", width: 16 },
  { header: "Interview Score", width: 10 },
  { header: "AI Feedback", width: 60 },
  { header: "Next Review", width: 16 },
  { header: "Invite Sent For", width: 16 },
  { header: "Last Reminder", width: 13 },
]; // J..O

const WRITABLE: Partial<Record<Field, string>> = {
  status: "F",
  score: "K",
  feedback: "L",
  nextReview: "M",
  inviteSentFor: "N",
  lastReminder: "O",
};

export const excelPath = () => path.resolve(process.cwd(), process.env.EXCEL_FILE || "ML_Learning_Tracker.xlsx");
export const excelExists = () => existsSync(excelPath());

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel stores wall-clock time as if it were UTC. */
function excelDate(d: Date): string {
  const day = d.toISOString().slice(0, 10);
  return d.getUTCHours() || d.getUTCMinutes() ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}

function text(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return excelDate(value);
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if ("result" in v) return text(v.result);
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return text(v.text);
    return "";
  }
  return String(value).trim();
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

type PhaseWindow = { start: string; days: number; focus: string };

/** Same chaining as the Roadmap formulas: each phase with weeks > 0 starts where the previous one ended. */
function phaseWindows(wb: ExcelJS.Workbook): Map<string, PhaseWindow> {
  const ws = wb.getWorksheet(ROADMAP);
  const windows = new Map<string, PhaseWindow>();
  const start = ws ? text(ws.getCell("B2").value).slice(0, 10) : "";
  if (!ws || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return windows;

  let cursor = start;
  for (let r = 7; r <= ws.rowCount; r++) {
    const code = text(ws.getCell(`A${r}`).value);
    if (!/^P\d/.test(code)) break;
    const weeks = Number(text(ws.getCell(`C${r}`).value)) || 0;
    if (weeks <= 0) continue;
    windows.set(code, { start: cursor, days: Math.round(weeks * 7), focus: text(ws.getCell(`B${r}`).value) });
    cursor = addDays(cursor, Math.round(weeks * 7));
  }
  return windows;
}

function parseRows(wb: ExcelJS.Workbook): Row[] {
  const ws = wb.getWorksheet(TOPICS);
  if (!ws) throw new Error(`The workbook has no "${TOPICS}" sheet`);
  const windows = phaseWindows(wb);

  const topicRows: ExcelJS.Row[] = [];
  ws.eachRow((row, n) => {
    if (n > 1 && text(row.getCell(3).value)) topicRows.push(row);
  });
  const perPhase = new Map<string, number>();
  for (const row of topicRows) {
    const phase = text(row.getCell(4).value);
    perPhase.set(phase, (perPhase.get(phase) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return topicRows.map((row) => {
    const cell = (col: string) => text(row.getCell(col).value);
    const phase = cell("D");
    const index = seen.get(phase) ?? 0;
    seen.set(phase, index + 1);

    // Spread a phase's topics evenly across its weeks, in sheet order. Column J overrides.
    let planned = cell("J");
    const window = windows.get(phase);
    if (!planned && window) {
      const offset = Math.max(0, Math.ceil(((index + 1) * window.days) / perPhase.get(phase)!) - 1);
      planned = `${addDays(window.start, offset)} ${DUE_TIME}`;
    }

    return {
      row: row.number,
      topic: cell("C"),
      category: cell("B"),
      phase,
      phaseName: window?.focus,
      keyPoints: [
        `Category: ${cell("B")}`,
        window?.focus && `Part of the phase: ${window.focus}`,
        cell("E") && `Priority: ${cell("E")}`,
        cell("I") && `Notes: ${cell("I")}`,
      ]
        .filter(Boolean)
        .join("\n"),
      planned,
      completed: cell("H").slice(0, 10),
      status: cell("F") || STATUS.NOT_STARTED,
      score: cell("K"),
      feedback: cell("L"),
      nextReview: cell("M"),
      inviteSentFor: cell("N"),
      lastReminder: cell("O"),
    };
  });
}

async function load(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath());
  return wb;
}

function parseHistory(wb: ExcelJS.Workbook): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  wb.getWorksheet(HISTORY)?.eachRow((row, n) => {
    if (n === 1) return;
    const date = text(row.getCell(1).value);
    const score = Number(text(row.getCell(3).value));
    if (date && Number.isFinite(score)) entries.push({ date, topic: text(row.getCell(2).value), score });
  });
  return entries;
}

export type WeekLog = { weekStart: string; hours: number; notes: string };

/** Weekly Log sheet: B week starting, C hours studied, D topics. The template's example row is skipped. */
function parseWeeklyLog(wb: ExcelJS.Workbook): WeekLog[] {
  const weeks: WeekLog[] = [];
  wb.getWorksheet(WEEKLY_LOG)?.eachRow((row, n) => {
    if (n === 1) return;
    const weekStart = text(row.getCell(2).value).slice(0, 10);
    const hours = Number(text(row.getCell(3).value));
    const notes = text(row.getCell(4).value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart) && hours > 0 && !notes.startsWith("EXAMPLE ROW")) {
      weeks.push({ weekStart, hours, notes });
    }
  });
  return weeks;
}

type Parsed = { mtimeMs: number; rows: Row[]; history: HistoryEntry[]; weeks: WeekLog[] };
let cache: Parsed | undefined;

async function parsed(): Promise<Parsed> {
  const mtimeMs = statSync(excelPath()).mtimeMs;
  if (cache?.mtimeMs !== mtimeMs) {
    const wb = await load();
    cache = { mtimeMs, rows: parseRows(wb), history: parseHistory(wb), weeks: parseWeeklyLog(wb) };
  }
  return cache;
}

export async function listExcelRows(): Promise<Row[]> {
  return (await parsed()).rows;
}

export async function listExcelHistory(): Promise<HistoryEntry[]> {
  return (await parsed()).history;
}

export async function listExcelWeeks(): Promise<WeekLog[]> {
  return (await parsed()).weeks;
}

// Writes are serialized so two requests never save over each other.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

type ValidationModel = { model: Record<string, unknown> };

/**
 * Works around two ExcelJS 4.4 write bugs that would otherwise alter the workbook:
 * - it merges per-cell dropdowns after sorting addresses as text ("F10" < "F2"), producing overlapping
 *   ranges that Excel offers to "repair", so we hand it contiguous column ranges instead;
 * - it drops columns whose width is exactly 9 (its internal default).
 */
function fixExcelJsQuirks(wb: ExcelJS.Workbook): void {
  for (const ws of wb.worksheets) {
    const validations = (ws as unknown as { dataValidations: ValidationModel }).dataValidations.model;
    const groups = new Map<string, { col: string; rows: number[]; rule: unknown }>();
    for (const [address, rule] of Object.entries(validations)) {
      const match = /^([A-Z]+)(\d+)$/.exec(address);
      if (!match) continue;
      const key = `${match[1]}|${JSON.stringify(rule)}`;
      const group = groups.get(key) ?? { col: match[1], rows: [], rule };
      group.rows.push(Number(match[2]));
      groups.set(key, group);
      delete validations[address];
    }
    for (const { col, rows, rule } of groups.values()) {
      rows.sort((a, b) => a - b);
      let start = rows[0];
      rows.forEach((row, i) => {
        if (rows[i + 1] === row + 1) return;
        validations[start === row ? `${col}${row}` : `${col}${start}:${col}${row}`] = rule;
        start = rows[i + 1];
      });
    }

    for (let i = 1; i <= ws.columnCount; i++) {
      if (ws.getColumn(i).width === 9) ws.getColumn(i).width = 9.01;
    }
  }
}

async function save(wb: ExcelJS.Workbook): Promise<void> {
  fixExcelJsQuirks(wb);
  wb.calcProperties.fullCalcOnLoad = true; // Roadmap totals recalculate when opened
  await wb.xlsx.writeFile(excelPath());
  cache = undefined;
}

/** Adds the app's columns, statuses and history sheet. Idempotent; backs up the original file first. */
function prepare(wb: ExcelJS.Workbook): void {
  const ws = wb.getWorksheet(TOPICS)!;
  if (!text(ws.getCell("J1").value)) {
    const backup = excelPath().replace(/\.xlsx$/i, ".backup.xlsx");
    if (!existsSync(backup)) copyFileSync(excelPath(), backup);

    const headerStyle = ws.getCell("I1").style;
    EXTRA_COLUMNS.forEach(({ header, width }, i) => {
      const cell = ws.getRow(1).getCell(10 + i);
      cell.value = header;
      cell.style = structuredClone(headerStyle);
      ws.getColumn(10 + i).width = width;
    });

    const last = Math.max(ws.rowCount, 2);
    for (let r = 2; r <= last; r++) {
      ws.getCell(`F${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${STATUS_LIST.join(",")}"`],
      };
      ws.getCell(`L${r}`).alignment = { wrapText: true, vertical: "top" };
    }
    ws.autoFilter = `A1:O${last}`;
    // Not in ExcelJS's type definitions, but present at runtime: stretch the existing row colours to the new columns.
    const existing = (ws as unknown as { conditionalFormattings?: { ref: string }[] }).conditionalFormattings ?? [];
    for (const cf of existing) cf.ref = cf.ref.replace(/:I(\d+)$/, ":O$1");
    ws.addConditionalFormatting({
      ref: `A2:O${last}`,
      rules: [
        {
          type: "expression",
          priority: 10,
          formulae: [`$F2="${STATUS.NEEDS_WORK}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } } },
        },
        {
          type: "expression",
          priority: 11,
          formulae: [`$F2="${STATUS.READY}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFDDEBF7" } } },
        },
      ],
    });
  }

  if (!wb.getWorksheet(HISTORY)) {
    const history = wb.addWorksheet(HISTORY);
    history.columns = [
      { header: "Date", width: 17 },
      { header: "Topic", width: 32 },
      { header: "Score", width: 8 },
      { header: "Verdict", width: 40 },
      { header: "Feedback", width: 60 },
      { header: "Transcript", width: 80 },
    ];
    history.getRow(1).eachCell((cell) => (cell.style = structuredClone(ws.getCell("I1").style)));
    history.views = [{ state: "frozen", ySplit: 1 }];
  }
}

export type PhasePlan = { code: string; topics: number; days: number; start: string; end: string };

/**
 * Re-plans the Roadmap so every scheduled phase (Planned Weeks > 0) fits between `start` and `end`
 * (inclusive). Days are shared in proportion to each phase's topic count; phases set to 0 weeks stay unscheduled.
 */
export function setPlanWindow(start: string, end: string): Promise<PhasePlan[]> {
  return exclusive(async () => {
    const totalDays = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    const wb = await load();
    prepare(wb);
    const roadmap = wb.getWorksheet(ROADMAP);
    if (!roadmap) throw new Error(`The workbook has no "${ROADMAP}" sheet`);

    const counts = new Map<string, number>();
    for (const row of parseRows(wb)) counts.set(row.phase ?? "", (counts.get(row.phase ?? "") ?? 0) + 1);
    const phases: { r: number; code: string; topics: number }[] = [];
    for (let r = 7; r <= roadmap.rowCount; r++) {
      const code = text(roadmap.getCell(`A${r}`).value);
      if (!/^P\d/.test(code)) break;
      if ((Number(text(roadmap.getCell(`C${r}`).value)) || 0) > 0) phases.push({ r, code, topics: counts.get(code) ?? 0 });
    }
    if (!phases.length) throw new Error("No phase has Planned Weeks above 0 on the Roadmap.");
    if (totalDays < phases.length) throw new Error(`Need at least ${phases.length} days, one per phase.`);

    // Largest-remainder split, at least one day per phase.
    const allTopics = phases.reduce((n, p) => n + p.topics, 0) || phases.length;
    const exact = phases.map((p) => (Math.max(p.topics, 1) / allTopics) * totalDays);
    const days = exact.map((d) => Math.max(1, Math.floor(d)));
    let left = totalDays - days.reduce((a, b) => a + b, 0);
    const order = exact.map((d, i) => ({ i, rest: d - Math.floor(d) })).sort((a, b) => b.rest - a.rest);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) days[order[k].i]++;
    for (let k = order.length - 1; left < 0; k = (k - 1 + order.length) % order.length) {
      if (days[order[k].i] > 1) { days[order[k].i]--; left++; }
    }

    roadmap.getCell("B2").value = new Date(`${start}T00:00:00Z`);
    let cursor = start;
    const result = phases.map((p, i) => {
      const cell = roadmap.getCell(`C${p.r}`);
      cell.value = days[i] / 7;
      cell.numFmt = "0.0#";
      const phaseEnd = addDays(cursor, days[i] - 1);
      const plan = { code: p.code, topics: p.topics, days: days[i], start: cursor, end: phaseEnd };
      cursor = addDays(cursor, days[i]);
      return plan;
    });
    await save(wb);
    return result;
  });
}

/** Replaces the tracker with an uploaded workbook, keeping a timestamped backup of the current one. */
export function replaceExcel(upload: Buffer): Promise<{ topics: number }> {
  return exclusive(async () => {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(upload as unknown as ArrayBuffer);
    } catch {
      throw new Error("That file isn't a readable .xlsx workbook.");
    }
    if (!wb.getWorksheet(TOPICS)) throw new Error(`The workbook needs a "${TOPICS}" sheet.`);
    const topics = parseRows(wb).length;

    if (existsSync(excelPath())) {
      const dir = path.join(path.dirname(excelPath()), "backups");
      mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      copyFileSync(excelPath(), path.join(dir, `${path.basename(excelPath(), ".xlsx")}-${stamp}.xlsx`));
    }
    prepare(wb);
    await save(wb);
    return { topics };
  });
}

export function prepareExcel(): Promise<void> {
  return exclusive(async () => {
    const wb = await load();
    prepare(wb);
    await save(wb);
  });
}

export function updateExcelRows(updates: RowUpdate[]): Promise<void> {
  return exclusive(async () => {
    const wb = await load();
    prepare(wb);
    const ws = wb.getWorksheet(TOPICS)!;
    for (const { row, fields } of updates) {
      for (const [field, value] of Object.entries(fields)) {
        const col = WRITABLE[field as Field];
        if (!col) continue;
        const numeric = field === "score" && value !== "" && !Number.isNaN(Number(value));
        ws.getCell(`${col}${row}`).value = numeric ? Number(value) : value || null;

        const completed = ws.getCell(`H${row}`);
        if (field === "status" && value === STATUS.DONE && !completed.value) {
          completed.value = new Date(`${localDay(new Date())}T00:00:00Z`);
          if (!completed.numFmt || completed.numFmt === "General") completed.numFmt = "yyyy-mm-dd";
        }
      }
    }
    await save(wb);
  });
}

export function appendExcelHistory(values: string[]): Promise<void> {
  return exclusive(async () => {
    const wb = await load();
    prepare(wb);
    const row = wb.getWorksheet(HISTORY)!.addRow(values.map((v, i) => (i === 2 && v !== "" ? Number(v) : v)));
    row.alignment = { wrapText: true, vertical: "top" };
    await save(wb);
  });
}
