"use client";

import { useEffect, useRef, useState } from "react";
import { END_MARKER, STATUS, type ChatTurn } from "@/lib/constants";
import Markdown from "./Markdown";

type Result = {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  feedback: string;
  status: string;
  nextReview: string;
};

// The interviewer is asked for roughly 6-8 questions; used only for the progress bar.
const EXPECTED_QUESTIONS = 7;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function Message({ turn }: { turn: ChatTurn }) {
  const mine = turn.role === "user";
  return (
    <div className={`msg ${mine ? "mine" : "theirs"}`}>
      <div className="avatar" aria-hidden>
        {mine ? "You" : "AI"}
      </div>
      <div className="msg-body">
        <div className="msg-name">{mine ? "You" : "Interviewer"}</div>
        <div className="bubble">
          {mine ? <p className="plain">{turn.content}</p> : <Markdown text={turn.content.replace(END_MARKER, "").trim()} />}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: Result }) {
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
      <a href="/" className="button-link">
        Back to tracker
      </a>
    </section>
  );
}

export default function InterviewChat({ row }: { row: number }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const finished = turns.some((t) => t.role === "assistant" && t.content.includes(END_MARKER));
  const answered = turns.filter((t) => t.role === "user").length;
  const progress = finished || result ? 100 : Math.min(95, (answered / EXPECTED_QUESTIONS) * 100);

  async function ask(history: ChatTurn[]) {
    setBusy(true);
    setError("");
    try {
      const { reply } = await post<{ reply: string }>("/api/interview", { row, turns: history });
      setTurns([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    ask([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, result, busy]);

  // Grow the answer box with its content.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [draft]);

  function send() {
    const answer = draft.trim();
    if (!answer || busy) return;
    setDraft("");
    const history: ChatTurn[] = [...turns, { role: "user", content: answer }];
    setTurns(history);
    ask(history);
  }

  async function finish() {
    setBusy(true);
    setScoring(true);
    setError("");
    try {
      setResult(await post<Result>("/api/interview/finish", { row, turns }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setScoring(false);
    }
  }

  return (
    <>
      <div className="progress" aria-label="Interview progress">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="muted small progress-label">
        {result ? "Interview complete" : finished ? "Interview finished - get your score" : `${answered} answered`}
      </p>

      <div className="chat">
        {turns.map((turn, i) => (
          <Message key={i} turn={turn} />
        ))}
        {busy && (
          <div className="msg theirs">
            <div className="avatar" aria-hidden>
              AI
            </div>
            <div className="msg-body">
              <div className="msg-name">{scoring ? "Scoring your answers" : "Interviewer"}</div>
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
        <ResultCard result={result} />
      ) : (
        <div className="composer">
          {!finished && (
            <textarea
              ref={input}
              rows={2}
              value={draft}
              placeholder="Type your answer..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
          )}
          <div className="composer-bar">
            <span className="muted small hint">
              {finished ? "The interviewer has wrapped up." : "Enter to send · Shift + Enter for a new line"}
            </span>
            <div className="actions">
              <button
                className={finished ? undefined : "secondary"}
                onClick={finish}
                disabled={busy || answered === 0}
                title={answered === 0 ? "Answer at least one question first" : "End the interview and get your score"}
              >
                Finish &amp; score
              </button>
              {!finished && (
                <button onClick={send} disabled={busy || !draft.trim()}>
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div ref={bottom} />
    </>
  );
}
