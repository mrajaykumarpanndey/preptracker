import type { focusStats } from "@/lib/focus";
import { minutesLabel } from "@/lib/focus";
import { ChartCard, DailyFocus, Empty, FocusByHour, Legend } from "./charts";

/** Focus tiles plus the per-day and by-hour charts; used on the Progress and Focus pages. */
export default function FocusSection({ focus }: { focus: ReturnType<typeof focusStats> }) {
  return (
    <>
      <div className="stats">
        <div className="card stat">
          <div className="stat-value">{minutesLabel(focus.todayMinutes)}</div>
          <div className="muted small">focused today</div>
        </div>
        <div className="card stat">
          <div className="stat-value">{minutesLabel(focus.weekMinutes)}</div>
          <div className="muted small">focused in the last 7 days</div>
        </div>
        <div className="card stat">
          <div className="stat-value">
            {focus.streak} day{focus.streak === 1 ? "" : "s"}
          </div>
          <div className="muted small">focus streak</div>
        </div>
        <div className="card stat">
          <div className="stat-value">{focus.guidesRead}</div>
          <div className="muted small">study guides read (80%+)</div>
        </div>
      </div>
      <div className="chart-grid" style={{ marginBottom: 16 }}>
        <ChartCard
          wide
          title="Focused time per day"
          subtitle="Minutes you actually had a guide or interview open and in focus - last 14 days"
          legend={
            <Legend
              items={[
                { label: "Reading guides", swatch: "s1" },
                { label: "Mock interviews", swatch: "s2" },
              ]}
            />
          }
          table={
            <table className="data-table">
              <thead>
                <tr><th>Day</th><th>Reading (min)</th><th>Interviews (min)</th></tr>
              </thead>
              <tbody>
                {focus.perDay.map((d) => (
                  <tr key={d.day}><td>{d.day}</td><td>{Math.round(d.reading)}</td><td>{Math.round(d.interview)}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          {focus.events.length ? (
            <DailyFocus days={focus.perDay} />
          ) : (
            <Empty>Open a study guide from your timetable and read for a while - your focused time shows up here.</Empty>
          )}
        </ChartCard>
        <ChartCard
          wide
          title="When you focus best"
          subtitle="All focused minutes by the hour they started - plan hard topics for your best hours"
          table={
            <table className="data-table">
              <thead>
                <tr><th>Hour</th><th>Focused minutes</th></tr>
              </thead>
              <tbody>
                {focus.byHour.map((h) => (
                  <tr key={h.hour}><td>{String(h.hour % 24).padStart(2, "0")}:00</td><td>{Math.round(h.minutes)}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          {focus.events.length ? <FocusByHour hours={focus.byHour} /> : <Empty>Builds up as you study.</Empty>}
        </ChartCard>
      </div>
    </>
  );
}
