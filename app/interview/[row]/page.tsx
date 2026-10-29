import Link from "next/link";
import { getRow } from "@/lib/store";
import InterviewChat from "./InterviewChat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ row: string }> }) {
  const { row: rowParam } = await params;
  const row = await getRow(Number(rowParam));

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
    <div className="interview">
      <Link href="/" className="back">
        &larr; Back to tracker
      </Link>
      <header className="interview-head">
        <p className="eyebrow">Mock interview</p>
        <h1>{row.topic}</h1>
        <div className="chips">
          {row.category && <span className="chip">{row.category}</span>}
          {row.phase && <span className="chip">{row.phase}</span>}
          {row.score && <span className="chip">Last score {row.score}/10</span>}
          <Link href={`/guide/${row.row}`} className="chip chip-link">
            Study guide
          </Link>
        </div>
      </header>
      <InterviewChat row={row.row} />
    </div>
  );
}
