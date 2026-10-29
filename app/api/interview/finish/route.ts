import { NextResponse } from "next/server";
import { evaluateInterview } from "@/lib/claude";
import { interviewContext } from "@/lib/guide";
import { config } from "@/lib/config";
import { STATUS, type ChatTurn } from "@/lib/constants";
import { esc, heading, list, p, renderEmail } from "@/lib/emailTemplate";
import { sendMail } from "@/lib/mail";
import { appendHistory, getRow, updateRow } from "@/lib/store";
import { formatLocal, localDay, parseLocal } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { row: rowNumber, turns, focusedSeconds = 0 } = (await req.json()) as {
    row: number;
    turns: ChatTurn[];
    focusedSeconds?: number;
  };
  const focusedMinutes = Math.round((Math.max(0, Number(focusedSeconds) || 0) / 60) * 10) / 10;
  const row = await getRow(rowNumber);
  if (!row) return NextResponse.json({ error: "Topic not found in the sheet" }, { status: 404 });
  if (!turns.some((t) => t.role === "user")) {
    return NextResponse.json({ error: "Answer at least one question before finishing." }, { status: 400 });
  }

  try {
    const result = await evaluateInterview(row.topic, interviewContext(row), turns);
    const passed = result.score >= config.passScore;
    const status = passed ? STATUS.DONE : STATUS.NEEDS_WORK;
    const now = new Date();
    // Retry on the evening of the retry day (a date without a time is read as 19:00).
    const retryDay = localDay(new Date(now.getTime() + config.retryDays * 86_400_000));
    const nextReview = passed ? "" : formatLocal(parseLocal(retryDay)!);
    const feedback = [
      `${result.verdict} (Understanding ${result.understanding}/10, Building ${result.application}/10)`,
      result.gaps.length ? `Revise: ${result.gaps.join("; ")}` : "",
      result.feedback,
      `Build next: ${result.buildNext}`,
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
      String(focusedMinutes),
    ]);

    await sendMail({
      subject: `${row.topic}: ${result.score}/10 - ${passed ? "passed" : "needs another round"}`,
      html: renderEmail({
        preheader: result.verdict,
        title: passed ? `You passed ${row.topic} with ${result.score}/10` : `${row.topic}: ${result.score}/10 - one more round`,
        body: [
          p(`<b>${esc(result.verdict)}</b>`),
          p(`Understanding <b>${result.understanding}/10</b> &nbsp;·&nbsp; Building &amp; applying <b>${result.application}/10</b>`),
          result.strengths.length ? heading("What went well") + list(result.strengths.map(esc)) : "",
          result.gaps.length ? heading("Revise these") + list(result.gaps.map(esc)) : "",
          heading("Advice"),
          p(esc(result.feedback)),
          heading("Build next"),
          p(esc(result.buildNext)),
          p(`Focused time: <b>${focusedMinutes} min</b> across ${turns.filter((t) => t.role === "user").length} answers.`),
          p(
            passed
              ? "This topic is now marked <b>Done</b> in your tracker."
              : `It's marked <b>Needs Modification</b>. Your retry is booked for <b>${esc(nextReview)}</b>.`,
          ),
        ].join(""),
        cta: passed ? { label: "See your progress", url: `${config.appUrl}/insights` } : { label: "Practise again", url: `${config.appUrl}/interview/${row.row}` },
        ctaColor: passed ? "#1f8a4c" : undefined,
      }),
    }).catch((error) => console.error("Result email failed", error));

    return NextResponse.json({ ...result, status, nextReview });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
