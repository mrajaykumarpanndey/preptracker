"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUS, type QuizQuestion, type QuizReview } from "@/lib/constants";
import { duration, useFocusTimer } from "../../useFocusTimer";
import Markdown from "./Markdown";

type Result = {
  score: number;
  correct: number;
  total: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  review: QuizReview[];
  status: string;
  nextReview: string;
};

type Previous = { count: number; best: number; last: number };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const letter = (i: number) => String.fromCharCode(65 + i);

function QuestionCard({
  q,
  index,
  chosen,
  review,
  onChoose,
}: {
  q: QuizQuestion;
  index: number;
  chosen: number | null;
  review?: QuizReview;
  onChoose: (option: number) => void;
}) {
  return (
    <section className={`card quiz-question ${review ? (review.correct ? "right" : "wrong") : ""}`}>
      <div className="q-box">
        <span className="q-label">
          Question {index + 1} · {q.concept}
        </span>
        <Markdown text={q.question} />
      </div>
      {q.code && (
        <div className="q-context md">
          <pre>
            <code>{q.code}</code>
          </pre>
        </div>
      )}
      <div className="quiz-options" role="radiogroup" aria-label={`Question ${index + 1} options`}>
        {q.options.map((option, i) => {
          const state = review
            ? i === review.answer
              ? "answer"
              : i === review.chosen
                ? "missed"
                : ""
            : i === chosen
              ? "chosen"
              : "";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === chosen}
              className={`quiz-option ${state}`}
              disabled={!!review}
              onClick={() => onChoose(i)}
            >
              <span className="quiz-letter">{letter(i)}</span>
              <Markdown text={option} />
            </button>
          );
        })}
      </div>
      {review && (
        <p className="quiz-explanation">
          <b>{review.chosen === null ? "Skipped." : review.correct ? "Correct." : `Answer: ${letter(review.answer)}.`}</b>{" "}
          {review.explanation}
        </p>
      )}
    </section>
  );
}

function ResultCard({ result, row }: { result: Result; row: number }) {
  const passed = result.status === STATUS.DONE;
  return (
    <section className={`result ${passed ? "pass" : "retry"}`}>
      <div className="result-top">
        <div className="score-ring" style={{ ["--pct" as string]: `${result.score * 10}%` }}>
          <span>{result.score}</span>
          <small>/ 10</small>
        </div>
        <div>
          <h2>{result.verdict}</h2>
          <p className="muted small">
            {passed
              ? "This topic is now marked Done in your tracker."
              : `Marked Needs Modification - your retry is booked for ${result.nextReview}.`}
          </p>
        </div>
      </div>
      <div className="result-grid">
        {result.strengths.length > 0 && (
          <div>
            <h3>You know</h3>
            <ul>
              {result.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {result.gaps.length > 0 && (
          <div>
            <h3>Revise</h3>
            <ul>
              {result.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="guide-actions">
        <Link href={`/guide/${row}`} className="button-link">
          {passed ? "Back to the guide" : "Reread the guide"}
        </Link>
        <Link href="/quiz" className="button-link secondary-link">
          All quizzes
        </Link>
      </div>
    </section>
  );
}

export default function QuizRunner({ row, topic, previous }: { row: number; topic: string; previous?: Previous }) {
  const [quiz, setQuiz] = useState<{ id: string; questions: QuizQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useFocusTimer(!quiz || !!result);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const next = await post<{ id: string; questions: QuizQuestion[] }>("/api/quiz", { row });
      setQuiz(next);
      setAnswers(next.questions.map(() => null));
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!quiz) return;
    const blanks = answers.filter((a) => a === null).length;
    if (blanks && !confirm(`${blanks} question${blanks === 1 ? " is" : "s are"} unanswered and will count as wrong. Submit anyway?`)) return;
    setBusy(true);
    setError("");
    try {
      setResult(await post<Result>("/api/quiz/finish", { id: quiz.id, answers, focusedSeconds: timer.seconds }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!quiz) {
    return (
      <section className="lobby">
        <h2>Ready to check what you learned?</h2>
        <ul className="lobby-list">
          <li>10 multiple-choice questions written from your study guide on {topic}.</li>
          <li>Fresh questions every attempt; answers and explanations appear after you submit.</li>
          <li>Score 7 or more to mark the topic Done.</li>
          {previous && (
            <li>
              Attempt #{previous.count + 1} - last score {previous.last}/10, best {previous.best}/10.
            </li>
          )}
        </ul>
        {error && <div className="card error">{error}</div>}
        <div className="guide-actions">
          <button type="button" className="big" onClick={start} disabled={busy}>
            {busy ? "Writing your quiz..." : "Start the quiz"}
          </button>
          <Link href={`/guide/${row}`} className="button-link secondary-link">
            Read the guide first
          </Link>
        </div>
      </section>
    );
  }

  const answered = answers.filter((a) => a !== null).length;
  return (
    <div className="quiz-body">
      {result && <ResultCard result={result} row={row} />}
      {quiz.questions.map((q, i) => (
        <QuestionCard
          key={i}
          q={q}
          index={i}
          chosen={answers[i]}
          review={result?.review[i]}
          onChoose={(option) => setAnswers((list) => list.map((a, j) => (j === i ? option : a)))}
        />
      ))}
      {error && <div className="card error">{error}</div>}
      {result ? (
        <div className="guide-actions">
          <button type="button" onClick={start} disabled={busy}>
            {busy ? "Writing a new quiz..." : "Take a new quiz"}
          </button>
        </div>
      ) : (
        <div className="quiz-bar">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(answered / quiz.questions.length) * 100}%` }} />
          </div>
          <div className="quiz-bar-row">
            <span className="muted small">
              {answered} of {quiz.questions.length} answered
            </span>
            <span className={`focus-timer ${timer.focused ? "" : "paused"}`} title="Counts only while this tab is open and focused">
              <span className="focus-dot" aria-hidden />
              <b>{duration(timer.seconds)}</b>
              {!timer.focused && <span className="paused-badge">Paused</span>}
            </span>
            <button type="button" onClick={submit} disabled={busy || answered === 0}>
              {busy ? "Marking..." : "Submit answers"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
