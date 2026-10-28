import Link from "next/link";
import { config } from "@/lib/config";
import { REVIEWABLE, STATUS } from "@/lib/constants";
import { hasData, listHistory, listRows, listWeeks } from "@/lib/store";
import { localDay, parseLocal } from "@/lib/time";
import Nav from "../Nav";
import {
  BurnUp,
  CategoryScores,
  ChartCard,
  Empty,
  Legend,
  PhaseProgress,
  ScoreTimeline,
  WeeklyHours,
  type BurnPoint,
  type PhaseStat,
} from "./charts";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export default async function InsightsPage() {
  if (!hasData()) {
    return (
      <>
        <Nav active="/insights" />
        <div className="card" style={{ marginTop: 16 }}>
          Add your tracker on the <Link href="/settings">Settings</Link> page first.
        </div>
      </>
    );
  }

  const [rows, history, weeks] = await Promise.all([listRows(), listHistory(), listWeeks()]);
  const today = localDay(new Date());

  // Progress by phase, in sheet order.
  const phases: PhaseStat[] = [];
  for (const row of rows) {
    const code = row.phase || "Other";
    let phase = phases.find((p) => p.code === code);
    if (!phase) phases.push((phase = { code, name: row.phaseName, total: 0, done: 0, active: 0 }));
    phase.total++;
    if (row.status === STATUS.DONE) phase.done++;
    else if (REVIEWABLE.includes(row.status)) phase.active++;
  }

  // Plan vs actual, sampled weekly across the scheduled plan.
  const plannedDays = rows
    .map((r) => parseLocal(r.planned))
    .filter((d): d is Date => d !== null)
    .map((d) => localDay(d))
    .sort();
  const completedDays = rows.filter((r) => r.status === STATUS.DONE && r.completed).map((r) => r.completed!);
  let burn: BurnPoint[] = [];
  if (plannedDays.length) {
    const start = addDays(plannedDays[0], -1);
    const end = plannedDays[plannedDays.length - 1];
    const samples = new Set<string>();
    for (let d = start; d <= end; d = addDays(d, 7)) samples.add(d);
    samples.add(end);
    if (today > start && today < end) samples.add(today);
    burn = [...samples].sort().map((day) => ({
      day,
      planned: plannedDays.filter((p) => p <= day).length,
      done: day <= today ? completedDays.filter((c) => c <= day).length : null,
    }));
  }
  const plannedByNow = plannedDays.filter((p) => p <= today).length;
  const doneTotal = rows.filter((r) => r.status === STATUS.DONE).length;
  const gap = doneTotal - plannedByNow;

  // Interviews.
  const interviews = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const passed = interviews.filter((h) => h.score >= config.passScore).length;
  const avgScore = interviews.length ? interviews.reduce((s, h) => s + h.score, 0) / interviews.length : null;

  // Average of each topic's latest score, by category.
  const categoryOf = new Map(rows.map((r) => [r.topic, r.category || r.phase || "Other"]));
  const latest = new Map<string, number>();
  for (const h of interviews) latest.set(h.topic, h.score);
  const byCategory = new Map<string, number[]>();
  for (const [topic, score] of latest) {
    const category = categoryOf.get(topic) ?? "Other";
    byCategory.set(category, [...(byCategory.get(category) ?? []), score]);
  }
  const categories = [...byCategory]
    .map(([category, scores]) => ({ category, avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }))
    .sort((a, b) => a.avg - b.avg);

  const totalHours = weeks.reduce((s, w) => s + w.hours, 0);

  return (
    <>
      <Nav active="/insights" />

      <div className="stats">
        <div className="card stat">
          <div className="stat-value">{Math.round((doneTotal / Math.max(rows.length, 1)) * 100)}%</div>
          <div className="muted small">
            of all {rows.length} topics done
          </div>
        </div>
        <div className="card stat">
          <div className={`stat-value ${gap < 0 ? "overdue" : ""}`}>
            {plannedDays[0] && today < plannedDays[0] ? "-" : gap === 0 ? "On track" : gap > 0 ? `+${gap}` : gap}
          </div>
          <div className="muted small">
            {plannedDays[0] && today < plannedDays[0]
              ? "plan hasn't started yet"
              : gap < 0
                ? `topics behind plan (${plannedByNow} due by today)`
                : gap > 0
                  ? "topics ahead of plan"
                  : `${plannedByNow} topics due by today`}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-value">{interviews.length}</div>
          <div className="muted small">
            interviews taken{interviews.length ? `, ${passed} passed` : ""}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-value">{avgScore === null ? "-" : avgScore.toFixed(1)}</div>
          <div className="muted small">average score (pass is {config.passScore})</div>
        </div>
      </div>

      <div className="chart-grid">
        <ChartCard
          title="Progress by phase"
          subtitle="Topics per phase of your roadmap"
          legend={
            <Legend
              items={[
                { label: "Done", swatch: "s1" },
                { label: "In progress / review", swatch: "s2" },
                { label: "Not started", swatch: "track" },
              ]}
            />
          }
          table={
            <table className="data-table">
              <thead>
                <tr><th>Phase</th><th>Done</th><th>In progress</th><th>Total</th></tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.code}><td>{p.code}</td><td>{p.done}</td><td>{p.active}</td><td>{p.total}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <PhaseProgress phases={phases} />
        </ChartCard>

        <ChartCard
          title="Average score by category"
          subtitle="Latest score per topic, averaged - weakest first"
          table={
            categories.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr><th>Category</th><th>Average</th><th>Topics</th></tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.category}><td>{c.category}</td><td>{c.avg.toFixed(1)}</td><td>{c.count}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          }
        >
          {categories.length ? (
            <CategoryScores items={categories} />
          ) : (
            <Empty>Scores by category appear after your first interview.</Empty>
          )}
        </ChartCard>

        <ChartCard
          title="Plan vs actual"
          wide
          subtitle="Cumulative topics due by each date versus topics completed"
          legend={
            <Legend
              items={[
                { label: "Planned", swatch: "s1" },
                { label: "Completed", swatch: "s2" },
              ]}
            />
          }
          table={
            burn.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Planned</th><th>Completed</th></tr>
                </thead>
                <tbody>
                  {burn.map((p) => (
                    <tr key={p.day}><td>{p.day}</td><td>{p.planned}</td><td>{p.done ?? "-"}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          }
        >
          {burn.length > 1 ? (
            <>
              <BurnUp points={burn} today={today} />
              {today < burn[0].day && (
                <p className="muted small">Your plan starts on {burn[0].day}; the completed line appears once it begins.</p>
              )}
            </>
          ) : (
            <Empty>No dated topics yet. Set a Start date and Planned Weeks on the Roadmap sheet.</Empty>
          )}
        </ChartCard>

        <ChartCard
          title="Interview scores"
          wide
          subtitle="Every interview in the order you took it"
          table={
            interviews.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Topic</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {interviews.map((h, i) => (
                    <tr key={i}><td>{h.date}</td><td>{h.topic}</td><td>{h.score}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          }
        >
          {interviews.length ? (
            <ScoreTimeline points={interviews} passScore={config.passScore} />
          ) : (
            <Empty>No interviews yet. Your scores will appear here after your first one.</Empty>
          )}
        </ChartCard>

        <ChartCard
          title="Weekly study hours"
          wide
          subtitle={weeks.length ? `${totalHours} hours logged over ${weeks.length} week${weeks.length === 1 ? "" : "s"}` : "From the Weekly Log sheet"}
          table={
            weeks.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr><th>Week starting</th><th>Hours</th><th>Worked on</th></tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.weekStart}><td>{w.weekStart}</td><td>{w.hours}</td><td>{w.notes}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          }
        >
          {weeks.length ? (
            <WeeklyHours weeks={weeks} />
          ) : (
            <Empty>
              Log your hours in the <b>Weekly Log</b> sheet of the Excel file (Week Starting + Hours Studied) and they&apos;ll
              show here. The template&apos;s example row is ignored.
            </Empty>
          )}
        </ChartCard>
      </div>
    </>
  );
}
