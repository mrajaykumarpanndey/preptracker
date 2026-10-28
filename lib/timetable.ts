import { config } from "./config";
import { REVIEWABLE, STATUS } from "./constants";
import type { Row } from "./sheets";
import { localDay, parseLocal } from "./time";

// The daily study plan shared by the dashboard board, interview invites and the morning email,
// so all three show the same sessions at the same times.

export const FIRST_HOUR = 8;
export const LAST_HOUR = 22;
const MAX_STUDY_PER_DAY = 8;
const INTERVIEW_START = 19;
const INTERVIEW_LENGTH = 0.5;

export type Kind = "study" | "retry" | "ahead" | "interview";
export type Block = { row: number; topic: string; category?: string; kind: Kind; start: number; end: number; note?: string };
export type PlanDay = { day: string; isToday: boolean; blocks: Block[]; more: number };

export function dueDate(row: Row): Date | null {
  return parseLocal(row.nextReview) ?? parseLocal(row.planned);
}

export const clock = (h: number) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const reviewable = (row: Row) => row.status !== STATUS.DONE && REVIEWABLE.includes(row.status);

function sameDayInterviews(rows: Row[], day: string): Row[] {
  return rows
    .filter((r) => reviewable(r) && dueDate(r) && localDay(dueDate(r)!) === day)
    .sort((a, b) => dueDate(a)!.getTime() - dueDate(b)!.getTime() || a.row - b.row);
}

/** Evening interview slot for a topic on its due day: 19:00, 19:30, 20:00 ... in due order. */
export function interviewStart(rows: Row[], row: Row): Date | null {
  const due = dueDate(row);
  if (!due) return null;
  const day = localDay(due);
  const index = Math.max(0, sameDayInterviews(rows, day).findIndex((r) => r.row === row.row));
  const hour = Math.min(INTERVIEW_START + index * INTERVIEW_LENGTH, LAST_HOUR - INTERVIEW_LENGTH);
  return parseLocal(`${day} ${clock(hour)}`);
}

export function planDays(rows: Row[], today: string, count: number): PlanDay[] {
  const days = Array.from({ length: count }, (_, i) => addDays(today, i));
  const lastDay = days[count - 1];
  const buckets = new Map<string, Row[]>(days.map((d) => [d, []]));
  const pending = rows
    .filter((r) => r.status !== STATUS.DONE)
    .map((row) => ({ row, due: dueDate(row) }))
    .filter((p): p is { row: Row; due: Date } => p.due !== null)
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  const later: Row[] = [];
  for (const { row, due } of pending) {
    const day = localDay(due);
    if (day < today) buckets.get(today)!.push(row); // overdue lands on today
    else if (day <= lastDay) buckets.get(day)!.push(row);
    else later.push(row);
  }

  // Free days get the next upcoming topic so there's always something to do.
  const ahead = new Set<number>();
  for (const day of days) {
    if (buckets.get(day)!.length === 0 && later.length) {
      const row = later.shift()!;
      ahead.add(row.row);
      buckets.get(day)!.push(row);
    }
  }

  // The study day is a morning and an afternoon session around a one-hour lunch break.
  const morning = Math.min(3, config.studyHoursPerDay / 2);
  const windows = [
    { start: config.studyStartHour, end: config.studyStartHour + morning },
    { start: config.studyStartHour + morning + 1, end: config.studyStartHour + config.studyHoursPerDay + 1 },
  ];

  return days.map((day) => {
    const items = buckets.get(day)!;
    const shown = items.slice(0, MAX_STUDY_PER_DAY);
    const blocks: Block[] = [];
    const kindOf = (row: Row): Kind => (ahead.has(row.row) ? "ahead" : row.status === STATUS.NEEDS_WORK ? "retry" : "study");
    const add = (row: Row, start: number, end: number, note: string) =>
      blocks.push({ row: row.row, topic: row.topic, category: row.category, kind: kindOf(row), start, end, note });

    if (shown.length === 1) {
      // One topic: learn it in the morning, practise it in the afternoon.
      add(shown[0], windows[0].start, windows[0].end, "Learn");
      add(shown[0], windows[1].start, windows[1].end, "Practice");
    } else if (shown.length > 1) {
      // Several topics: share the two sessions evenly.
      const perWindow = Math.ceil(shown.length / 2);
      shown.forEach((row, i) => {
        const half = Math.floor(i / perWindow);
        const w = windows[half];
        const inWindow = half === 0 ? perWindow : shown.length - perWindow;
        const length = (w.end - w.start) / inWindow;
        const start = w.start + length * (i % perWindow);
        add(row, start, start + length - (inWindow > 1 ? 0.1 : 0), "Study");
      });
    }

    // Half-hour mock interviews in the evening, at the same times the invites use.
    const evening = [
      ...sameDayInterviews(rows, day),
      ...(day === today ? items.filter((r) => reviewable(r) && localDay(dueDate(r)!) < today) : []), // overdue
    ];
    evening.forEach((row, i) => {
      const start = INTERVIEW_START + i * INTERVIEW_LENGTH;
      if (start + INTERVIEW_LENGTH > LAST_HOUR) return;
      blocks.push({ row: row.row, topic: row.topic, category: row.category, kind: "interview", start, end: start + INTERVIEW_LENGTH });
    });

    return { day, isToday: day === today, blocks, more: items.length - shown.length };
  });
}
