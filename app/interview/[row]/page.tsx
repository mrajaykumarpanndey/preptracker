import Link from "next/link";
import { attemptsByTopic, getRow, listHistory } from "@/lib/store";
import InterviewChat from "./InterviewChat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ row: string }> }) {
  const { row: rowParam } = await params;
  const [row, history] = await Promise.all([getRow(Number(rowParam)), listHistory()]);
  const previous = row ? attemptsByTopic(history).get(row.topic) : undefined;

  if (!row) {
    return (
      <div className="interview">
        <div className="card error">
          No topic found in row {rowParam}. <Link href="/">Back to tracker</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="interview room-page">
      <Link href="/" className="back">
        &larr; Back to tracker
      </Link>
      <header className="interview-head">
        <p className="eyebrow">Mock interview</p>
        <h1>{row.topic}</h1>
        <div className="chips">
          <span className="chip chip-attempt">Attempt #{(previous?.count ?? 0) + 1}</span>
          {row.category && <span className="chip">{row.category}</span>}
          {row.phase && <span className="chip">{row.phase}</span>}
          {row.score && <span className="chip">Last score {row.score}/10</span>}
          <Link href={`/guide/${row.row}`} className="chip chip-link">
            Study guide
          </Link>
        </div>
      </header>
      <InterviewChat row={row.row} topic={row.topic} previous={previous} />
    </div>
  );
}
