import Link from "next/link";
import { clock, currentStudyDay, daySchedule, FIRST_HOUR, LAST_HOUR, planDays, type Kind } from "@/lib/timetable";
import type { Row } from "@/lib/store";

// A week planner: study sessions and mock interviews for the next 7 days. Collapsed by default;
// renders on the server with plain HTML/CSS. The plan itself comes from lib/timetable, which the
// interview invites and morning email also use.

const DAYS = 7;

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

const LABEL: Record<Kind, string> = {
  study: "Study",
  retry: "Revise & retry",
  ahead: "Get ahead",
  interview: "Mock interview",
};

export default function WeekBoard({ rows }: { rows: Row[] }) {
  const { day: today, hour: nowHour } = currentStudyDay();
  const days = planDays(rows, today, DAYS);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const pct = (h: number) => `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%`;

  const studyCount = days.reduce((n, d) => n + d.blocks.filter((b) => b.kind !== "interview").length, 0);
  const interviewCount = days.reduce((n, d) => n + d.blocks.filter((b) => b.kind === "interview").length, 0);
  const todayBlocks = days[0].blocks.filter((b) => b.kind !== "interview").length;

  return (
    <details className="week">
      <summary className="week-head">
        <div>
          <p className="eyebrow">Your week</p>
          <h2>
            {todayBlocks
              ? `${todayBlocks} session${todayBlocks === 1 ? "" : "s"} today - one tile at a time.`
              : "A free day - pick a Get ahead tile and bank some progress."}
          </h2>
          <p className="muted small">
            {studyCount} study sessions and {interviewCount} mock interview{interviewCount === 1 ? "" : "s"} planned over the
            next 7 days. Click to open the timetable.
          </p>
        </div>
        <span className="week-toggle" aria-hidden />
      </summary>

      <div className="week-legend">
        {(["study", "retry", "ahead", "interview"] as Kind[]).map((k) => (
          <span key={k}>
            <i className={`key ${k}`} aria-hidden />
            {LABEL[k]}
          </span>
        ))}
        <span className="week-hint">Study tiles open the study guide · interview tiles open the mock interview</span>
      </div>

      <div className="week-scroll">
        <div className="week-stage">
          <div
            className="week-board"
            role="table"
            aria-label="Study timetable for the next 7 days"
            style={{ ["--span" as string]: LAST_HOUR - FIRST_HOUR }}
          >
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
                  {(() => {
                    const office = daySchedule(d.day).office;
                    return office ? (
                      <div
                        className="week-office"
                        style={{ top: pct(office.start), height: `calc(${pct(office.end)} - ${pct(office.start)})` }}
                      >
                        Office
                        <span>
                          {clock(office.start)}-{clock(office.end)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {d.isToday && nowHour >= FIRST_HOUR && nowHour <= LAST_HOUR && (
                    <div className="week-now" style={{ top: pct(nowHour) }} aria-label={`Now, ${clock(nowHour)}`} />
                  )}
                  {d.blocks.map((b, i) => (
                    <Link
                      key={`${b.kind}-${b.row}-${i}`}
                      href={b.kind === "interview" ? `/interview/${b.row}` : `/guide/${b.row}`}
                      className={`tile ${b.kind} ${b.end - b.start < 1 ? "short" : b.end - b.start < 1.6 ? "mid" : ""}`}
                      style={{ top: pct(b.start), height: `calc(${pct(b.end)} - ${pct(b.start)})` }}
                      title={`${LABEL[b.kind]}: ${b.topic}${b.category ? ` (${b.category})` : ""}, ${clock(b.start)}-${clock(b.end)}`}
                    >
                      <span className="tile-time">
                        {clock(b.start)}-{clock(b.end)}
                      </span>
                      <span className="tile-title">
                        <span className="tile-note">{b.kind === "interview" ? "Interview" : b.note}</span> {b.topic}
                      </span>
                      {b.end - b.start >= 2 && b.category && <span className="tile-sub">{b.category}</span>}
                    </Link>
                  ))}
                  {d.more > 0 && <span className="week-more">+{d.more} more due</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
