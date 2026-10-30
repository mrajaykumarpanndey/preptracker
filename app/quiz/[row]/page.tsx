import Link from "next/link";
import { READ_COMPLETE } from "@/lib/constants";
import { readProgress } from "@/lib/quiz";
import { attemptsByTopic, getRow, listHistory, listStudy } from "@/lib/store";
import QuizRunner from "./QuizRunner";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ row: string }> }) {
  const { row: rowParam } = await params;
  const [row, history, study] = await Promise.all([getRow(Number(rowParam)), listHistory(), listStudy()]);

  if (!row) {
    return (
      <div className="quiz">
        <div className="card error">
          No topic found in row {rowParam}. <Link href="/quiz">Back to quizzes</Link>
        </div>
      </div>
    );
  }

  const previous = attemptsByTopic(history).get(row.topic);
  const read = readProgress(study).get(row.topic);

  return (
    <div className="quiz">
      <Link href="/quiz" className="back">
        &larr; All quizzes
      </Link>
      <header className="quiz-head">
        <p className="eyebrow">Quiz</p>
        <h1>{row.topic}</h1>
        <div className="chips">
          <span className="chip chip-attempt">Attempt #{(previous?.count ?? 0) + 1}</span>
          {row.category && <span className="chip">{row.category}</span>}
          {row.phase && <span className="chip">{row.phase}</span>}
          {row.score && <span className="chip">Last score {row.score}/10</span>}
          <Link href={`/guide/${row.row}`} className="chip chip-link">
            Study guide{read !== undefined ? ` · ${read}% read` : ""}
          </Link>
        </div>
        {read !== undefined && read < READ_COMPLETE && (
          <p className="muted small">You haven&apos;t finished reading this guide yet - the quiz only asks about what&apos;s in it.</p>
        )}
      </header>
      <QuizRunner row={row.row} topic={row.topic} previous={previous} />
    </div>
  );
}
