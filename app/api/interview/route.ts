import { NextResponse } from "next/server";
import { nextInterviewTurn } from "@/lib/claude";
import { interviewContext } from "@/lib/guide";
import { STATUS, type ChatTurn } from "@/lib/constants";
import { getRow, updateRow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { row: rowNumber, turns } = (await req.json()) as { row: number; turns: ChatTurn[] };
  const row = await getRow(rowNumber);
  if (!row) return NextResponse.json({ error: "Topic not found in the sheet" }, { status: 404 });

  try {
    const reply = await nextInterviewTurn(row.topic, interviewContext(row), turns);
    if (turns.length === 0 && (!row.status || row.status === STATUS.NOT_STARTED)) {
      await updateRow(row.row, { status: STATUS.IN_PROGRESS });
    }
    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
