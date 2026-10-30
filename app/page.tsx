import Link from "next/link";
import FeedbackDetails from "./FeedbackDetails";
import StatusSelect from "./StatusSelect";
import WeekBoard from "./WeekBoard";
import { config } from "@/lib/config";
import { REVIEWABLE, STATUS } from "@/lib/constants";
import { excelPath } from "@/lib/excel";
import { oauthConfigured, oauthConnected } from "@/lib/google";
import { dueDate } from "@/lib/scheduler";
import { attemptsByTopic, dataSource, hasData, listHistory, listRows, type Attempts, type Row } from "@/lib/store";
import { formatLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const VIEWS = {
  focus: "Due soon & in review",
  pending: "All pending",
  all: "All topics",
} as const;
type View = keyof typeof VIEWS;

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

function DueCell({ due, done, now }: { due: Date | null; done: boolean; now: number }) {
  if (!due) return <span className="muted">-</span>;
  const local = formatLocal(due); // "2026-11-01 19:00" in the tracker's timezone
  const [day, time] = local.split(" ");
  const days = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${formatLocal(new Date(now)).slice(0, 10)}T00:00:00Z`)) / DAY);
  const late = !done && due.getTime() < now;
  const relative = done
    ? ""
    : late
      ? days === 0 ? "due today" : `${-days} day${days === -1 ? "" : "s"} overdue`
      : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return (
    <div className="due">
      <div className={late ? "overdue" : undefined}>
        {DATE_FORMAT.format(new Date(`${day}T12:00:00Z`))} &middot; {time}
      </div>
      {relative && <div className={`small ${late ? "overdue" : "muted"}`}>{relative}</div>}
    </div>
  );
}

function ScoreBadge({ score }: { score: string }) {
  if (!score) return <span className="muted">-</span>;
  const value = Number(score);
  return <span className={`score-badge ${value >= 7 ? "good" : value >= 4 ? "mid" : "low"}`}>{score}/10</span>;
}

/** Feedback is stored as "verdict\nRevise: a; b; c\nadvice" - show the verdict, the rest in a modal. */
function Feedback({ row }: { row: Row }) {
  if (!row.feedback) return <span className="muted">-</span>;
  const [verdict, ...rest] = row.feedback.split("\n");
  const reviseLine = rest.find((line) => line.startsWith("Revise:"));
  const revise = reviseLine
    ? reviseLine.replace(/^Revise:\s*/, "").split(/;\s+/).map((item) => item.replace(/`/g, ""))
    : [];
  const advice = rest.filter((line) => line !== reviseLine).join(" ").replace(/`/g, "");
  return (
    <div className="feedback">
      <p className="clamp" title={verdict}>
        {verdict}
      </p>
      <FeedbackDetails
        row={row.row}
        topic={row.topic}
        category={row.category}
        score={row.score}
        verdict={verdict}
        revise={revise}
        advice={advice}
      />
    </div>
  );
}

function Header() {
  return <h1 className="page-title">Tracker</h1>;
}

function inView(row: Row, view: View, now: number): boolean {
  if (view === "all") return true;
  if (row.status === STATUS.DONE) return false;
  if (view === "pending") return true;
  const due = dueDate(row);
  return REVIEWABLE.includes(row.status) || (due !== null && due.getTime() - now < 7 * DAY);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const source = dataSource();
  if (source === "google" && oauthConfigured() && !oauthConnected()) {
    return (
      <>
        <Header />
        <div className="card">
          <p>Connect your Google account so the tracker can read and update your sheet and add quizzes to your calendar.</p>
          <a href="/api/google/auth">
            <button>Connect Google</button>
          </a>
        </div>
      </>
    );
  }

  if (!hasData()) {
    return (
      <>
        <Header />
        <div className="card">
          <p>Add your tracker (an Excel file or a Google Sheet) to get started.</p>
          <Link href="/settings">
            <button>Open Settings</button>
          </Link>
        </div>
      </>
    );
  }

  let rows: Row[];
  let attempts: Map<string, Attempts>;
  let quizzesTaken = 0;
  let quizzesPassed = 0;
  try {
    const [rowList, history] = await Promise.all([listRows(), listHistory()]);
    rows = rowList;
    attempts = attemptsByTopic(history);
    quizzesTaken = history.length;
    quizzesPassed = history.filter((h) => h.score >= config.passScore).length;
  } catch (error) {
    return (
      <>
        <Header />
        <div className="card error">
          Couldn&apos;t read your tracker {source === "excel" ? `(${excelPath()})` : "Google Sheet"}. Check it on the{" "}
          <Link href="/settings">Settings</Link> page.{"\n\n"}
          {String(error)}
        </div>
      </>
    );
  }

  const { view: viewParam } = await searchParams;
  const view: View = viewParam && viewParam in VIEWS ? (viewParam as View) : "focus";
  const now = Date.now();
  const done = rows.filter((r) => r.status === STATUS.DONE).length;
  const overdue = rows.filter((r) => r.status !== STATUS.DONE && (dueDate(r)?.getTime() ?? Infinity) < now).length;
  const inReview = rows.filter((r) => REVIEWABLE.includes(r.status)).length;
  const scored = rows.filter((r) => r.score !== "");
  const avgScore = scored.length ? scored.reduce((sum, r) => sum + Number(r.score), 0) / scored.length : null;
  const visible = rows
    .filter((row) => inView(row, view, now))
    .sort((a, b) => (dueDate(a)?.getTime() ?? Infinity) - (dueDate(b)?.getTime() ?? Infinity));
  const showPhase = rows.some((r) => r.phase);

  return (
    <>
      <Header />
      <div className="stats">
        <div className="card stat">
          <div className="stat-value">
            {done}/{rows.length}
          </div>
          <div className="muted small">topics done ({Math.round((done / Math.max(rows.length, 1)) * 100)}%)</div>
        </div>
        <div className="card stat">
          <div className={`stat-value ${overdue ? "overdue" : ""}`}>{overdue}</div>
          <div className="muted small">overdue</div>
        </div>
        <div className="card stat">
          <div className="stat-value">{inReview}</div>
          <div className="muted small">in progress / review</div>
        </div>
        <div className="card stat">
          <div className="stat-value">{quizzesTaken}</div>
          <div className="muted small">
            quizzes attempted{quizzesTaken ? `, ${quizzesPassed} passed` : ""}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-value">{avgScore === null ? "-" : avgScore.toFixed(1)}</div>
          <div className="muted small">average quiz score</div>
        </div>
      </div>

      <WeekBoard rows={rows} />

      <nav className="tabs">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link key={key} href={`/?view=${key}`} className={key === view ? "active" : undefined}>
            {VIEWS[key]}
          </Link>
        ))}
      </nav>
      <p className="muted small">
        Set a topic to &quot;{STATUS.IN_PROGRESS}&quot; when you start it (click its status); you&apos;ll get a quiz
        invite before its due date.
      </p>

      {visible.length === 0 ? (
        <div className="card muted" style={{ marginTop: 16 }}>
          Nothing here right now.{" "}
          {view === "focus" && <Link href="/?view=pending">See all pending topics</Link>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-topic">Topic</th>
                {showPhase && <th>Phase</th>}
                <th>Status</th>
                <th>Due</th>
                <th>Score</th>
                <th className="col-feedback">Feedback</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                return (
                  <tr key={row.row}>
                    <td>
                      {row.topic}
                      {row.category && <div className="muted small">{row.category}</div>}
                    </td>
                    {showPhase && <td>{row.phase}</td>}
                    <td>
                      <StatusSelect key={row.status} row={row.row} status={row.status} />
                    </td>
                    <td>
                      <DueCell due={dueDate(row)} done={row.status === STATUS.DONE} now={now} />
                    </td>
                    <td>
                      <ScoreBadge score={row.score} />
                      {attempts.get(row.topic) && (
                        <div className="muted small attempts">
                          {attempts.get(row.topic)!.count} attempt{attempts.get(row.topic)!.count === 1 ? "" : "s"}
                          {attempts.get(row.topic)!.count > 1 && <> · best {attempts.get(row.topic)!.best}</>}
                        </div>
                      )}
                    </td>
                    <td>
                      <Feedback row={row} />
                    </td>
                    <td className="action">
                      <Link href={`/guide/${row.row}`} className="guide-link">
                        Guide
                      </Link>
                      <Link href={`/quiz/${row.row}`} className="quiz-link">
                        {row.status === STATUS.DONE ? "Retake" : row.score ? "Retry" : "Start"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
