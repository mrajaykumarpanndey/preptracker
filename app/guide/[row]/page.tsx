import Link from "next/link";
import { getGuide } from "@/lib/guide";
import { getRow } from "@/lib/store";
import GuideDocument from "./GuideDocument";
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
      <GuideDocument row={row.row} guide={guide} />
    </article>
  );
}
