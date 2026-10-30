import { NextResponse } from "next/server";
import { STATUS } from "@/lib/constants";
import { createQuiz } from "@/lib/quiz";
import { getRow, updateRow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  const { row: rowNumber } = (await req.json()) as { row: number };
  const row = await getRow(rowNumber);
  if (!row) return NextResponse.json({ error: "Topic not found in the sheet" }, { status: 404 });

  try {
    const quiz = await createQuiz(row);
    if (!row.status || row.status === STATUS.NOT_STARTED) await updateRow(row.row, { status: STATUS.IN_PROGRESS });
    return NextResponse.json(quiz);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
