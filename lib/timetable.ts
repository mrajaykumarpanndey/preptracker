import { config } from "./config";
import { REVIEWABLE, STATUS } from "./constants";
import type { Row } from "./sheets";
import { formatLocal, localDay, parseLocal } from "./time";

// The daily study plan shared by the dashboard board, quiz invites and the morning email,
// so all three show the same sessions at the same times.

// A "study day" runs from waking up until going to sleep, which can be after midnight: hours past 24
// (e.g. 26 = 02:00) belong to the evening before.
export const FIRST_HOUR = config.wakeHour;
export const LAST_HOUR = config.sleepStartHour + 24;
const MAX_STUDY_PER_DAY = 12;
const MIN_SESSION = 0.5; // hours
const QUIZ_LENGTH = 0.5;

type Window = { start: number; end: number };
export type DaySchedule = { windows: Window[]; quizSlots: number[]; quizStart: number; office?: Window };

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/**
 * When you can study on a given day, around office and sleep.
 * Office days: an hour to get home, 3h of study, quizzes, then a late session until an hour before sleep.
 * Free days: two daytime sessions after waking, quizzes after dinner, then an evening session.
 */
export function daySchedule(day: string): DaySchedule {
  const lastAwake = LAST_HOUR - 1; // stop studying an hour before sleep
  if (config.officeDays.includes(weekdayOf(day))) {
    const office = { start: config.officeStartHour, end: config.officeEndHour };
    const evening = { start: office.end + 1, end: office.end + 4 };
    const late = { start: evening.end + 1, end: lastAwake };
    const quizSlots = [evening.end, evening.end + 0.5, late.end, late.end + 0.5];
    return {
      windows: [evening, late].filter((w) => w.end - w.start >= 0.5),
      quizSlots,
      quizStart: quizSlots[0],
      office,
    };
  }
  const wake = config.wakeHour;
  const windows = [
    { start: wake + 2, end: wake + 5 },
    { start: wake + 6, end: wake + 10 },
    { start: wake + 12, end: Math.min(wake + 15, lastAwake) },
  ].filter((w) => w.end - w.start >= 0.5);
  const quizSlots = [wake + 11, wake + 11.5, lastAwake, lastAwake + 0.5];
  return { windows, quizSlots, quizStart: quizSlots[0] };
}

/** The study day you're in right now, and the hour on its clock (after midnight counts as 24+). */
export function currentStudyDay(now = new Date()): { day: string; hour: number } {
  const [hh, mm] = formatLocal(now).slice(11).split(":").map(Number);
  const hour = hh + mm / 60;
  return hour < config.sleepStartHour
    ? { day: addDays(localDay(now), -1), hour: hour + 24 }
    : { day: localDay(now), hour };
}

/** Study hours available on a day - used to give busier days fewer topics. */
export function dayCapacity(day: string): number {
  return daySchedule(day).windows.reduce((sum, w) => sum + (w.end - w.start), 0);
}

export type Kind = "study" | "retry" | "ahead" | "quiz";
export type Block = { row: number; topic: string; category?: string; kind: Kind; start: number; end: number; note?: string };
export type PlanDay = { day: string; isToday: boolean; blocks: Block[]; more: number };

export function dueDate(row: Row): Date | null {
  return parseLocal(row.nextReview) ?? parseLocal(row.planned);
}

export const clock = (h: number) =>
  `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const reviewable = (row: Row) => row.status !== STATUS.DONE && REVIEWABLE.includes(row.status);

function sameDayQuizzes(rows: Row[], day: string): Row[] {
  return rows
    .filter((r) => reviewable(r) && dueDate(r) && localDay(dueDate(r)!) === day)
    .sort((a, b) => dueDate(a)!.getTime() - dueDate(b)!.getTime() || a.row - b.row);
}

/** Quiz slot for a topic on its due day, from that day's quiz slots in due order. */
export function quizStart(rows: Row[], row: Row): Date | null {
  const due = dueDate(row);
  if (!due) return null;
  const day = localDay(due);
  const index = Math.max(0, sameDayQuizzes(rows, day).findIndex((r) => r.row === row.row));
  const slots = daySchedule(day).quizSlots;
  const hour = slots[Math.min(index, slots.length - 1)];
  const date = parseLocal(`${day} ${clock(hour)}`);
  return date && hour >= 24 ? new Date(date.getTime() + 86_400_000) : date; // after midnight = next calendar day
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

  return days.map((day) => {
    const { windows, quizSlots } = daySchedule(day);
    const items = buckets.get(day)!;
    const shown = items.slice(0, MAX_STUDY_PER_DAY);
    const blocks: Block[] = [];
    const kindOf = (row: Row): Kind => (ahead.has(row.row) ? "ahead" : row.status === STATUS.NEEDS_WORK ? "retry" : "study");
    const add = (row: Row, start: number, end: number, note: string) =>
      blocks.push({ row: row.row, topic: row.topic, category: row.category, kind: kindOf(row), start, end, note });

    let placed = shown.length;
    if (shown.length === 1 && windows.length === 2) {
      // One topic: learn it in the first session, practise it in the second.
      add(shown[0], windows[0].start, windows[0].end, "Learn");
      add(shown[0], windows[1].start, windows[1].end, "Practice");
    } else if (shown.length > 0) {
      // Several topics: each session gets a share proportional to its length.
      const total = windows.reduce((sum, w) => sum + (w.end - w.start), 0);
      let next = 0;
      windows.forEach((w, wi) => {
        const remaining = shown.length - next;
        const share = wi === windows.length - 1 ? remaining : Math.round((shown.length * (w.end - w.start)) / total);
        // At least half an hour each; what doesn't fit is shown as "+N more" rather than squeezed in.
        const count = Math.min(remaining, share, Math.floor((w.end - w.start) / MIN_SESSION));
        // Whole quarter-hours, so sessions read like 8:00 - 8:30 rather than 8:36 - 9:06.
        const length = Math.max(MIN_SESSION, Math.floor(((w.end - w.start) / Math.max(count, 1)) * 4) / 4);
        for (let k = 0; k < count; k++, next++) {
          const start = w.start + length * k;
          add(shown[next], start, start + length, "Study");
        }
      });
      placed = next;
    }

    // Half-hour quizzes in the evening, at the same times the invites use.
    const evening = [
      ...sameDayQuizzes(rows, day),
      ...(day === today ? items.filter((r) => reviewable(r) && localDay(dueDate(r)!) < today) : []), // overdue
    ];
    evening.forEach((row, i) => {
      if (i >= quizSlots.length) return;
      const start = quizSlots[i];
      blocks.push({ row: row.row, topic: row.topic, category: row.category, kind: "quiz", start, end: start + QUIZ_LENGTH });
    });

    return { day, isToday: day === today, blocks, more: items.length - placed };
  });
}
