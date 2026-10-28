"use client";

import Link from "next/link";
import { useRef } from "react";

type Props = {
  row: number;
  topic: string;
  category?: string;
  score: string;
  verdict: string;
  revise: string[];
  advice: string;
};

/** "Details" button that opens the full interview feedback in a modal dialog. */
export default function FeedbackDetails({ row, topic, category, score, verdict, revise, advice }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="link-button" onClick={() => dialog.current?.showModal()}>
        Details
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby={`feedback-title-${row}`}
        // Clicking the dimmed backdrop (outside the panel) closes it; Esc works natively.
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="modal-panel">
          <header className="modal-head">
            <div>
              <p className="eyebrow">Interview feedback</p>
              <h2 id={`feedback-title-${row}`}>{topic}</h2>
              {category && <p className="muted small">{category}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
              &times;
            </button>
          </header>

          <div className="modal-body">
            <div className="modal-verdict">
              {score && <span className={`score-badge ${Number(score) >= 7 ? "good" : Number(score) >= 4 ? "mid" : "low"}`}>{score}/10</span>}
              <p>{verdict}</p>
            </div>

            {revise.length > 0 && (
              <section>
                <h3>What to revise</h3>
                <ul className="revise-list">
                  {revise.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {advice && (
              <section>
                <h3>Advice</h3>
                <p className="advice">{advice}</p>
              </section>
            )}
          </div>

          <footer className="modal-foot">
            <button type="button" className="secondary" onClick={() => dialog.current?.close()}>
              Close
            </button>
            <Link href={`/interview/${row}`} className="button-link">
              Retry interview
            </Link>
          </footer>
        </div>
      </dialog>
    </>
  );
}
