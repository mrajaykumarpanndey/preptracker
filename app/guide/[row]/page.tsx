import Link from "next/link";
import { getGuide } from "@/lib/guide";
import { getRow } from "@/lib/store";
import ReadingTracker from "./ReadingTracker";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export default async function GuidePage({ params }: { params: Promise<{ row: string }> }) {
  const { row: rowParam } = await params;
  const row = await getRow(Number(rowParam));
  if (!row) {
    return (
      <div className="guide">
        <div className="card error">
          No topic found in row {rowParam}. <Link href="/">Back to tracker</Link>
        </div>
      </div>
    );
  }

  let guide;
  try {
    guide = await getGuide(row);
  } catch (error) {
    return (
      <div className="guide">
        <Link href="/" className="back">
          &larr; Back to tracker
        </Link>
        <div className="card error">
          Couldn&apos;t write the study guide right now: {error instanceof Error ? error.message : String(error)}. Reload to
          try again.
        </div>
      </div>
    );
  }

  return (
    <article className="guide">
      <ReadingTracker row={row.row} />
      <Link href="/" className="back">
        &larr; Back to tracker
      </Link>
      <p className="eyebrow">Study guide</p>
      <h1>{row.topic}</h1>
      <div className="chips">
        {row.category && <span className="chip">{row.category}</span>}
        {row.phase && <span className="chip">{row.phase}</span>}
      </div>
      <div className="guide-actions">
        <a href={`/api/guide/${row.row}`} className="button-link" target="_blank" rel="noreferrer">
          Download PDF
        </a>
        <Link href={`/interview/${row.row}`} className="button-link secondary-link">
          Start mock interview
        </Link>
      </div>

      <p className="guide-summary">{guide.summary}</p>
      <p className="muted">
        <b>Why interviewers ask:</b> {guide.whyItMatters}
      </p>

      <h2>Key ideas</h2>
      <ol className="guide-points">
        {guide.keyPoints.map((p) => (
          <li key={p.title}>
            <b>{p.title}</b>
            <span>{p.explanation}</span>
          </li>
        ))}
      </ol>

      {guide.diagram && (
        <>
          <h2>{guide.diagram.title}</h2>
          <div
            className="flow"
            role="img"
            aria-label={guide.diagram.steps.join(", then ")}
            style={{ gridTemplateColumns: `repeat(${guide.diagram.steps.length <= 4 ? guide.diagram.steps.length : 3}, 1fr)` }}
          >
            {guide.diagram.steps.map((step, i, all) => (
              <div
                key={i}
                className={`flow-step ${
                  i === all.length - 1 || (all.length > 4 && i % 3 === 2) ? "row-end" : ""
                }`}
              >
                <span className="flow-num">{i + 1}</span>
                {step}
              </div>
            ))}
          </div>
          <p className="muted small">{guide.diagram.caption}</p>
        </>
      )}

      {guide.code && (
        <>
          <h2>Example ({guide.code.language})</h2>
          <pre className="guide-code">
            <code>{guide.code.snippet}</code>
          </pre>
          <p className="muted small">{guide.code.explanation}</p>
        </>
      )}

      <h2>In real ML work</h2>
      <p>{guide.inPractice}</p>

      <section className="build">
        <p className="eyebrow">Build it yourself</p>
        <h2>{guide.buildIt.title}</h2>
        <p>
          <b>{guide.buildIt.goal}</b>
        </p>
        <ol>
          {guide.buildIt.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <dl>
          <dt>Use</dt>
          <dd>{guide.buildIt.resources}</dd>
          <dt>You should see</dt>
          <dd>{guide.buildIt.expected}</dd>
          <dt>Stretch</dt>
          <dd>{guide.buildIt.stretch}</dd>
        </dl>
      </section>

      <h2>Common mistakes</h2>
      <ul className="guide-pitfalls">
        {guide.pitfalls.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <h2>Questions you may be asked</h2>
      <div className="guide-qa">
        {guide.interviewQuestions.map((qa) => (
          <details key={qa.question}>
            <summary>{qa.question}</summary>
            <p>{qa.answer}</p>
          </details>
        ))}
      </div>

      <h2>Quick recap</h2>
      <ul className="guide-recap">
        {guide.recap.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <div className="guide-actions" style={{ marginTop: 28 }}>
        <Link href={`/interview/${row.row}`} className="button-link">
          I&apos;m ready - start the mock interview
        </Link>
      </div>
    </article>
  );
}
