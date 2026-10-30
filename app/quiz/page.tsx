import Link from "next/link";
import { READ_COMPLETE, STATUS } from "@/lib/constants";
import { readProgress } from "@/lib/quiz";
import { attemptsByTopic, hasData, listHistory, listRows, listStudy, type Row } from "@/lib/store";

export const dynamic = "force-dynamic";

function ScoreBadge({ score }: { score: string }) {
  if (!score) return <span className="muted small">Not taken yet</span>;
  const n = Number(score);
  return <span className={`score-badge ${n >= 7 ? "good" : n >= 4 ? "mid" : "low"}`}>{score}/10</span>;
}

/** Quizzes for the guides you've read to the end; guides you've started are listed underneath. */
export default async function QuizzesPage() {
  if (!hasData()) {
    return (
      <>
        <h1 className="page-title">Quizzes</h1>
        <div className="card" style={{ marginTop: 16 }}>
          Add your tracker on the <Link href="/settings">Settings</Link> page first.
        </div>
      </>
    );
  }

  const [rows, study, history] = await Promise.all([listRows(), listStudy(), listHistory()]);
  const read = readProgress(study);
  const attempts = attemptsByTopic(history);
  // Topics you've already been scored on stay here too (older scores, or reading not tracked in a Google Sheet).
  const ready = rows.filter((r) => (read.get(r.topic) ?? 0) >= READ_COMPLETE || attempts.has(r.topic) || r.score !== "");
  const reading = rows.filter((r) => !ready.includes(r) && (read.get(r.topic) ?? 0) > 0);
  const order = (r: Row) => (r.status === STATUS.DONE ? 1 : 0);
  ready.sort((a, b) => order(a) - order(b) || a.row - b.row);

  return (
    <>
      <h1 className="page-title">Quizzes</h1>
      <p className="muted" style={{ marginTop: 16 }}>
        Finish reading a study guide and its quiz shows up here: 10 multiple-choice questions written from that guide.
        Score 7 or more to mark the topic Done.
      </p>

      {ready.length === 0 ? (
        <div className="card muted" style={{ marginTop: 16 }}>
          No guides finished yet. Open a topic&apos;s <b>Guide</b> from the <Link href="/">Tracker</Link> and read it to the
          end - its quiz unlocks here.
        </div>
      ) : (
        <div className="quiz-list">
          {ready.map((row) => {
            const a = attempts.get(row.topic);
            return (
              <section key={row.row} className="card quiz-item">
                <div>
                  <h2>{row.topic}</h2>
                  <p className="muted small">
                    {[row.category, read.has(row.topic) ? `${read.get(row.topic)}% read` : "", a ? `${a.count} attempt${a.count === 1 ? "" : "s"}, best ${a.best}/10` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="quiz-item-actions">
                  <ScoreBadge score={row.score} />
                  <Link href={`/guide/${row.row}`} className="button-link secondary-link">
                    Guide
                  </Link>
                  <Link href={`/quiz/${row.row}`} className="button-link">
                    {row.score ? "Retake" : "Take quiz"}
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {reading.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Keep reading</h2>
          <p className="muted small">These guides aren&apos;t finished yet - read to the end to unlock the quiz.</p>
          <div className="quiz-list">
            {reading.map((row) => (
              <section key={row.row} className="card quiz-item">
                <div>
                  <h2>{row.topic}</h2>
                  <div className="progress" style={{ marginTop: 8 }}>
                    <div className="progress-bar" style={{ width: `${read.get(row.topic)}%` }} />
                  </div>
                  <p className="muted small">{read.get(row.topic)}% read</p>
                </div>
                <div className="quiz-item-actions">
                  <Link href={`/guide/${row.row}`} className="button-link secondary-link">
                    Continue reading
                  </Link>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
