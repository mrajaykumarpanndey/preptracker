"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { END_MARKER, STATUS, type ChatTurn } from "@/lib/constants";
import { duration, useFocusTimer } from "../../useFocusTimer";
import Markdown from "./Markdown";

type Result = {
  focusedSeconds: number;
  score: number;
  understanding: number;
  application: number;
  buildNext: string;
  verdict: string;
  strengths: string[];
  gaps: string[];
  feedback: string;
  status: string;
  nextReview: string;
};

// The interviewer is asked for roughly 6-8 questions; used for the progress dots.
const EXPECTED_QUESTIONS = 7;

const EXPLAIN = "Could you explain this question in more detail - what exactly you're asking, what the terms mean, and maybe a small example scenario? Please don't give away the answer.";
const REPHRASE = "Could you rephrase that question more simply?";

const QUICK_REPLIES = [
  { label: "💡 Hint", text: "Could I get a small hint for this one?" },
  { label: "🔎 Explain more", text: EXPLAIN },
  { label: "🔁 Rephrase", text: REPHRASE },
  { label: "⏭ Skip", text: "I'm not sure about this one - I'd like to skip it. Next question please." },
];

// Hints and rephrases stay on the same question; anything else the candidate sends (including a skip)
// moves the interview on.
const SAME_QUESTION = new Set(QUICK_REPLIES.slice(0, 3).map((q) => q.text));
const SHORT_LABEL = new Map(QUICK_REPLIES.map((q) => [q.text, q.label]));
const movesOn = (turn: ChatTurn) => turn.role === "user" && !SAME_QUESTION.has(turn.content);

/** Question number for each interviewer message (undefined for the closing message). */
function questionNumbers(turns: ChatTurn[]): (number | undefined)[] {
  let n = 0;
  let advance = true;
  return turns.map((t) => {
    if (t.role === "user") {
      advance = movesOn(t);
      return undefined;
    }
    if (t.content.includes(END_MARKER)) return undefined;
    if (advance || n === 0) n++;
    advance = false;
    return n;
  });
}

const TIPS = [
  "Think out loud - explain why, not just what.",
  "Give a small example or a few lines of code.",
  "Say what you'd check if it went wrong.",
];

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function Message({ turn, question, actions }: { turn: ChatTurn; question?: number; actions?: ReactNode }) {
  const mine = turn.role === "user";
  const quick = mine ? SHORT_LABEL.get(turn.content) : undefined;
  return (
    <div className={`msg ${mine ? "mine" : "theirs"}`}>
      <div className="avatar" aria-hidden>
        {mine ? "You" : "AI"}
      </div>
      <div className="msg-body">
        <div className="msg-name">{mine ? "You" : question ? `Interviewer · Question ${question}` : "Interviewer"}</div>
        <div className={`bubble ${quick ? "quick" : ""}`}>
          {quick ? <span>{quick}</span> : <Markdown text={turn.content.replace(END_MARKER, "").trim()} />}
        </div>
        {actions}
      </div>
    </div>
  );
}

function ResultCard({ result, row }: { result: Result; row: number }) {
  const passed = result.status === STATUS.DONE;
  return (
    <section className={`result ${passed ? "pass" : "retry"}`}>
      <div className="result-top">
        <div className="score-ring" style={{ ["--pct" as string]: `${result.score * 10}%` }}>
          <span>{result.score}</span>
          <small>/10</small>
        </div>
        <div>
          <p className="eyebrow">{passed ? "Passed - marked Done" : "Needs more work"}</p>
          <h2>{result.verdict}</h2>
          {!passed && result.nextReview && <p className="muted small">Next interview scheduled for {result.nextReview}</p>}
        </div>
      </div>
      <div className="subscores">
        <div>
          <span className="muted small">Understanding</span>
          <div className="subscore-bar">
            <i style={{ width: `${result.understanding * 10}%` }} />
          </div>
          <b>{result.understanding}/10</b>
        </div>
        <div>
          <span className="muted small">Building &amp; applying</span>
          <div className="subscore-bar">
            <i style={{ width: `${result.application * 10}%` }} />
          </div>
          <b>{result.application}/10</b>
        </div>
      </div>
      <div className="result-grid">
        {result.strengths.length > 0 && (
          <div>
            <h3>Strengths</h3>
            <ul>{result.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
        {result.gaps.length > 0 && (
          <div>
            <h3>Revise</h3>
            <ul>{result.gaps.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
      </div>
      <p className="advice">{result.feedback}</p>
      <div className="build-next">
        <p className="eyebrow">Build next</p>
        <p>{result.buildNext}</p>
      </div>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Focused time: <b>{duration(result.focusedSeconds)}</b>
      </p>
      <div className="actions" style={{ marginLeft: 0 }}>
        <Link href="/" className="button-link">
          Back to tracker
        </Link>
        <Link href={`/guide/${row}`} className="button-link secondary-link">
          Review the study guide
        </Link>
      </div>
    </section>
  );
}

/** Circular focus timer for the side panel. */
function TimerRing({ seconds, questionSeconds, focused, running }: { seconds: number; questionSeconds: number; focused: boolean; running: boolean }) {
  const minuteProgress = (seconds % 60) / 60;
  return (
    <div className={`timer-ring ${running && !focused ? "paused" : ""}`} title="Counts only while this tab is open and focused">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="52" className="track" />
        <circle cx="60" cy="60" r="52" className="arc" style={{ strokeDashoffset: `${326.7 * (1 - minuteProgress)}` }} />
      </svg>
      <div className="timer-ring-text">
        <b>{duration(seconds)}</b>
        <span>{!running ? "not started" : focused ? "focused" : "paused"}</span>
      </div>
      {running && <p className="muted small">This question {duration(questionSeconds)}</p>}
    </div>
  );
}

export default function InterviewChat({
  row,
  topic,
  previous,
}: {
  row: number;
  topic: string;
  previous?: { count: number; best: number; last: number };
}) {
  const [started, setStarted] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const timer = useFocusTimer(!started || result !== null);
  const timerRef = useRef(0);
  timerRef.current = timer.seconds;
  const questionStartedAt = useRef(0); // focused seconds when the latest question arrived
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const finished = turns.some((t) => t.role === "assistant" && t.content.includes(END_MARKER));
  const answered = turns.filter(movesOn).length;
  const numbers = questionNumbers(turns);
  const questionCount = Math.max(0, ...numbers.map((n) => n ?? 0));
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  async function ask(history: ChatTurn[]) {
    setBusy(true);
    setError("");
    try {
      const { reply } = await post<{ reply: string }>("/api/interview", { row, turns: history });
      setTurns([...history, { role: "assistant", content: reply }]);
      const last = history[history.length - 1];
      if (!last || movesOn(last)) questionStartedAt.current = timerRef.current; // a new question, not a hint
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function start() {
    setStarted(true);
    ask([]);
  }

  useEffect(() => {
    if (started) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, result, busy, started]);

  // Grow the answer box with its content.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [draft]);

  function send(text = draft) {
    const answer = text.trim();
    if (!answer || busy) return;
    setDraft("");
    const history: ChatTurn[] = [...turns, { role: "user", content: answer }];
    setTurns(history);
    ask(history);
  }

  function insertCode() {
    const el = input.current;
    const block = "\n```python\n\n```\n";
    const at = el?.selectionStart ?? draft.length;
    const next = draft.slice(0, at) + block + draft.slice(at);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + 11, at + 11); // inside the fence
    });
  }

  async function finish() {
    setBusy(true);
    setScoring(true);
    setError("");
    try {
      const focusedSeconds = timerRef.current;
      const scored = await post<Omit<Result, "focusedSeconds">>("/api/interview/finish", { row, turns, focusedSeconds });
      setResult({ ...scored, focusedSeconds });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setScoring(false);
    }
  }

  if (!started) {
    return (
      <section className="lobby">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>Mock interview on {topic}</h2>
          <p className="attempt-line">
            {previous ? (
              <>
                This is <b>attempt #{previous.count + 1}</b> - you&apos;ve tried this topic {previous.count} time
                {previous.count === 1 ? "" : "s"}. Best score <b>{previous.best}/10</b>, last <b>{previous.last}/10</b>.
              </>
            ) : (
              <>
                This is your <b>first attempt</b> at this topic.
              </>
            )}
          </p>
          <ul className="lobby-list">
            <li>
              <b>About {EXPECTED_QUESTIONS} questions</b>, one at a time - half on understanding, half on building and
              applying.
            </li>
            <li>
              Use <b>Hint</b>, <b>Rephrase</b> or <b>Skip</b> if you get stuck - hints count a little against the score.
            </li>
            <li>The timer only counts while this tab is in focus. Finish whenever you like to get your score.</li>
          </ul>
          <div className="actions" style={{ marginLeft: 0 }}>
            <button type="button" className="big" onClick={start}>
              Start interview
            </button>
            <Link href={`/guide/${row}`} className="button-link secondary-link">
              Read the study guide first
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="room">
      <div className="room-main">
        <div className="chat">
          {turns.map((turn, i) => (
            <Message
              key={i}
              turn={turn}
              question={numbers[i]}
              actions={
                i === turns.length - 1 && numbers[i] && !busy && !result ? (
                  <div className="bubble-actions">
                    <button type="button" className="link-button" onClick={() => send(EXPLAIN)}>
                      🔎 Explain this question
                    </button>
                    <button type="button" className="link-button" onClick={() => send(REPHRASE)}>
                      🔁 Rephrase simply
                    </button>
                  </div>
                ) : undefined
              }
            />
          ))}
          {busy && (
            <div className="msg theirs">
              <div className="avatar" aria-hidden>
                AI
              </div>
              <div className="msg-body">
                <div className="msg-name">{scoring ? "Scoring your answers" : "Interviewer is thinking"}</div>
                <div className="bubble typing" aria-label="Interviewer is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="card error">{error}</div>}

        {result ? (
          <ResultCard result={result} row={row} />
        ) : finished ? (
          <div className="wrap-up">
            <div>
              <b>That&apos;s the interview.</b>
              <p className="muted small">Get your score, strengths, what to revise and what to build next.</p>
            </div>
            <button type="button" className="big" onClick={finish} disabled={busy}>
              {scoring ? "Scoring…" : "Finish & score"}
            </button>
          </div>
        ) : (
          <div className="composer">
            <div className="quick-replies">
              {QUICK_REPLIES.map((q) => (
                <button key={q.label} type="button" className="chip-button" disabled={busy || questionCount === 0} onClick={() => send(q.text)}>
                  {q.label}
                </button>
              ))}
              <button type="button" className="chip-button" disabled={busy} onClick={insertCode}>
                {"{ }"} Code
              </button>
            </div>
            <textarea
              ref={input}
              rows={3}
              value={draft}
              placeholder="Type your answer… explain your thinking, add an example or code."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
            <div className="composer-bar">
              <span className="muted small hint">
                {words > 0 ? `${words} word${words === 1 ? "" : "s"} · ` : ""}Enter to send · Shift + Enter for a new line
              </span>
              <button type="button" className="send" onClick={() => send()} disabled={busy || !draft.trim()}>
                Send answer ↵
              </button>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <aside className="room-side">
        <TimerRing
          seconds={timer.seconds}
          questionSeconds={Math.max(0, timer.seconds - questionStartedAt.current)}
          focused={timer.focused}
          running={!result}
        />
        <div className="side-card">
          <div className="side-row">
            <b>Progress</b>
            <span className="muted small">
              {result ? "Complete" : `Question ${Math.max(questionCount, 1)} of ~${Math.max(EXPECTED_QUESTIONS, questionCount)}`}
            </span>
          </div>
          <div className="dots" aria-hidden>
            {Array.from({ length: Math.max(EXPECTED_QUESTIONS, questionCount) }, (_, i) => (
              <i key={i} className={i < answered ? "done" : i === answered && !finished && !result ? "current" : ""} />
            ))}
          </div>
          <p className="muted small">{answered} answered</p>
        </div>
        <div className="side-card">
          <b>Tips</b>
          <ul className="tips">
            {TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <Link href={`/guide/${row}`} target="_blank" className="small">
            Open the study guide ↗
          </Link>
        </div>
        {!result && !finished && (
          <button type="button" className="secondary finish-early" onClick={finish} disabled={busy || answered === 0}>
            Finish &amp; score now
          </button>
        )}
      </aside>
    </div>
  );
}
