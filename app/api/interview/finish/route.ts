import { NextResponse } from "next/server";
import { evaluateInterview } from "@/lib/claude";
import { config } from "@/lib/config";
import { STATUS, type ChatTurn } from "@/lib/constants";
import { escapeHtml, sendMail } from "@/lib/mail";
import { appendHistory, getRow, updateRow } from "@/lib/store";
import { formatLocal, localDay, parseLocal } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { row: rowNumber, turns } = (await req.json()) as { row: number; turns: ChatTurn[] };
  const row = await getRow(rowNumber);
  if (!row) return NextResponse.json({ error: "Topic not found in the sheet" }, { status: 404 });
  if (!turns.some((t) => t.role === "user")) {
    return NextResponse.json({ error: "Answer at least one question before finishing." }, { status: 400 });
  }

  try {
    const result = await evaluateInterview(row.topic, row.keyPoints, turns);
    const passed = result.score >= config.passScore;
    const status = passed ? STATUS.DONE : STATUS.NEEDS_WORK;
    const now = new Date();
    // Retry on the evening of the retry day (a date without a time is read as 19:00).
    const retryDay = localDay(new Date(now.getTime() + config.retryDays * 86_400_000));
    const nextReview = passed ? "" : formatLocal(parseLocal(retryDay)!);
    const feedback = [
      result.verdict,
      result.gaps.length ? `Revise: ${result.gaps.join("; ")}` : "",
      result.feedback,
    ]
      .filter(Boolean)
      .join("\n");

    await updateRow(row.row, { score: String(result.score), status, feedback, nextReview, inviteSentFor: "" });
    await appendHistory([
      formatLocal(now),
      row.topic,
      String(result.score),
      result.verdict,
      feedback,
      turns.map((t) => `${t.role === "assistant" ? "Q" : "A"}: ${t.content}`).join("\n\n"),
    ]);

    await sendMail({
      subject: `${row.topic}: scored ${result.score}/10 - ${status}`,
      html: `<p><b>${escapeHtml(result.verdict)}</b></p>
<p>Strengths:</p><ul>${result.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
<p>Revise:</p><ul>${result.gaps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
<p>${escapeHtml(result.feedback)}</p>
${passed ? "<p>Marked as Done.</p>" : `<p>Marked as Needs Modification. Next interview: <b>${nextReview}</b>.</p>`}`,
    }).catch((error) => console.error("Result email failed", error));

    return NextResponse.json({ ...result, status, nextReview });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
