import Link from "next/link";
import { focusStats, minutesLabel } from "@/lib/focus";
import { friendly } from "@/lib/time";
import { hasData, listHistory, listRows, listStudy } from "@/lib/store";
import FocusSection from "../insights/FocusSection";

export const dynamic = "force-dynamic";


export default async function FocusPage() {
  if (!hasData()) {
    return (
      <>
        <h1 className="page-title">Focus</h1>
        <div className="card" style={{ marginTop: 16 }}>
          Add your tracker on the <Link href="/settings">Settings</Link> page first.
        </div>
      </>
    );
  }
  const [rows, study, history] = await Promise.all([listRows(), listStudy(), listHistory()]);
  const focus = focusStats(study, history);
  const rowOf = new Map(rows.map((r) => [r.topic, r.row]));

  return (
    <>
      <h1 className="page-title">Focus</h1>
      <p className="muted" style={{ marginTop: 16 }}>
        Time counts only while a study guide or quiz is open and in focus. Open a study tile on your timetable to
        start a reading session.
      </p>
      <FocusSection focus={focus} />

      <div className="chart-grid">
        <section className="card chart-card">
          <header className="chart-head">
            <div>
              <h2>Time per topic</h2>
              <p className="muted small">Where your focus has gone, most first</p>
            </div>
          </header>
          {focus.topicTotals.length ? (
            <div className="bar-list">
              {focus.topicTotals.slice(0, 12).map((t) => {
                const total = t.reading + t.quiz;
                const max = focus.topicTotals[0].reading + focus.topicTotals[0].quiz;
                return (
                  <div key={t.topic} className="bar-row" title={`${Math.round(t.reading)} min reading, ${Math.round(t.quiz)} min quizzes`}>
                    <div className="bar-label">
                      {rowOf.has(t.topic) ? <Link href={`/guide/${rowOf.get(t.topic)}`}>{t.topic}</Link> : t.topic}
                    </div>
                    <div className="phase-bar">
                      {t.reading > 0 && <div className="seg s1" style={{ width: `${(t.reading / max) * 100}%` }} />}
                      {t.quiz > 0 && <div className="seg s2" style={{ width: `${(t.quiz / max) * 100}%` }} />}
                    </div>
                    <div className="bar-value">{minutesLabel(total)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="chart-empty">No sessions yet.</div>
          )}
        </section>

        <section className="card chart-card">
          <header className="chart-head">
            <div>
              <h2>Session log</h2>
              <p className="muted small">Every reading session and quiz, newest first</p>
            </div>
          </header>
          {focus.events.length ? (
            <div className="table-wrap" style={{ marginTop: 0, boxShadow: "none" }}>
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr><th>When</th><th>Topic</th><th>Activity</th><th>Focused</th><th>Read</th></tr>
                </thead>
                <tbody>
                  {focus.events.slice(0, 40).map((e, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {friendly(e.when)}
                      </td>
                      <td>{e.topic}</td>
                      <td>{e.kind === "reading" ? "Reading" : "Quiz"}</td>
                      <td>{minutesLabel(e.minutes)}</td>
                      <td>{e.readPercent === undefined ? "-" : `${e.readPercent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-empty">No sessions yet.</div>
          )}
        </section>
      </div>
    </>
  );
}
