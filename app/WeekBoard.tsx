import Link from "next/link";
import { config } from "@/lib/config";
import { REVIEWABLE, STATUS } from "@/lib/constants";
import { dueDate } from "@/lib/scheduler";
import type { Row } from "@/lib/store";
import { formatLocal, localDay } from "@/lib/time";

// A week planner drawn as a tilted board with raised tiles. Pure HTML/CSS (3D transforms + layered
// shadows), so it renders on the server and needs no client JavaScript.

const FIRST_HOUR = 8;
const LAST_HOUR = 21;
const DAYS = 7;
const MAX_STUDY_PER_DAY = 4;

type Kind = "study" | "retry" | "ahead" | "interview";
type Block = { row: number; topic: string; category?: string; kind: Kind; start: number; end: number; note?: string };
type Day = { day: string; isToday: boolean; blocks: Block[]; more: number };

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

function plan(rows: Row[], today: string): Day[] {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const lastDay = days[DAYS - 1];
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

  // Free days get the next upcoming topics so there's always something to do.
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
        const w = windows[Math.floor(i / perWindow)];
        const count = Math.floor(i / perWindow) === 0 ? perWindow : shown.length - perWindow;
        const length = (w.end - w.start) / count;
        const start = w.start + length * (i % perWindow);
        add(row, start, start + length - (count > 1 ? 0.15 : 0), "Study");
      });
    }

    // One-hour mock interviews in the evening for topics you're actively working on.
    let evening = 19;
    for (const row of shown) {
      if (ahead.has(row.row) || !REVIEWABLE.includes(row.status) || evening >= LAST_HOUR) continue;
      blocks.push({ row: row.row, topic: row.topic, category: row.category, kind: "interview", start: evening, end: evening + 1 });
      evening += 1;
    }
    return { day, isToday: day === today, blocks, more: items.length - shown.length };
  });
}

const LABEL: Record<Kind, string> = {
  study: "Study",
  retry: "Revise & retry",
  ahead: "Get ahead",
  interview: "Mock interview",
};

export default function WeekBoard({ rows }: { rows: Row[] }) {
  const now = new Date();
  const today = localDay(now);
  const days = plan(rows, today);
  const [hh, mm] = formatLocal(now).slice(11).split(":").map(Number);
  const nowHour = hh + mm / 60;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const pct = (h: number) => `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%`;

  const studyCount = days.reduce((n, d) => n + d.blocks.filter((b) => b.kind !== "interview").length, 0);
  const interviewCount = days.reduce((n, d) => n + d.blocks.filter((b) => b.kind === "interview").length, 0);
  const todayBlocks = days[0].blocks.filter((b) => b.kind !== "interview").length;

  return (
    <section className="week">
      <header className="week-head">
        <div>
          <p className="eyebrow">Your week</p>
          <h2>
            {todayBlocks
              ? `${todayBlocks} session${todayBlocks === 1 ? "" : "s"} today - one tile at a time.`
              : "A free day - pick a Get ahead tile and bank some progress."}
          </h2>
          <p className="muted small">
            {studyCount} study sessions and {interviewCount} mock interview{interviewCount === 1 ? "" : "s"} planned over the
            next 7 days. Click a tile to start.
          </p>
        </div>
        <div className="week-legend">
          {(["study", "retry", "ahead", "interview"] as Kind[]).map((k) => (
            <span key={k}>
              <i className={`key ${k}`} aria-hidden />
              {LABEL[k]}
            </span>
          ))}
        </div>
      </header>

      <div className="week-scroll">
        <div className="week-stage">
          <div className="week-board" role="table" aria-label="Study timetable for the next 7 days">
            <div className="week-hours" aria-hidden>
              <div className="week-corner" />
              <div className="week-hours-track">
                {hours.map((h) => (
                  <span key={h} style={{ top: pct(h) }}>
                    {clock(h)}
                  </span>
                ))}
              </div>
            </div>

            {days.map((d) => (
              <div key={d.day} className={`week-day ${d.isToday ? "today" : ""}`} role="row">
                <div className="week-day-head" role="columnheader">
                  <b>{d.isToday ? "Today" : weekday.format(asDate(d.day))}</b>
                  <span>{dayMonth.format(asDate(d.day))}</span>
                </div>
                <div className="week-col" role="cell">
                  {hours.map((h) => (
                    <i key={h} className="week-line" style={{ top: pct(h) }} aria-hidden />
                  ))}
                  {d.isToday && nowHour >= FIRST_HOUR && nowHour <= LAST_HOUR && (
                    <div className="week-now" style={{ top: pct(nowHour) }} aria-label={`Now, ${clock(nowHour)}`} />
                  )}
                  {d.blocks.map((b, i) => (
                    <Link
                      key={`${b.kind}-${b.row}-${i}`}
                      href={`/interview/${b.row}`}
                      className={`tile ${b.kind}`}
                      style={{ top: pct(b.start), height: `calc(${pct(b.end)} - ${pct(b.start)})` }}
                      title={`${LABEL[b.kind]}: ${b.topic}${b.category ? ` (${b.category})` : ""}, ${clock(b.start)}-${clock(b.end)}`}
                    >
                      <span className="tile-time">
                        {clock(b.start)}-{clock(b.end)}
                      </span>
                      <span className="tile-title">
                        <span className="tile-note">{b.kind === "interview" ? "Interview" : b.note}</span> {b.topic}
                      </span>
                      {b.end - b.start >= 1.5 && b.category && <span className="tile-sub">{b.category}</span>}
                    </Link>
                  ))}
                  {d.more > 0 && <span className="week-more">+{d.more} more due</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
