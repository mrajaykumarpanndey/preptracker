import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { STATUS } from "@/lib/constants";
import { esc, heading, list, p, renderEmail } from "@/lib/emailTemplate";
import { sendMail } from "@/lib/mail";
import { gradeQuiz } from "@/lib/quiz";
import { appendHistory, getRow, updateRow } from "@/lib/store";
import { formatLocal, localDay, parseLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, answers, focusedSeconds = 0 } = (await req.json()) as {
    id: string;
    answers: (number | null)[];
    focusedSeconds?: number;
  };
  const focusedMinutes = Math.round((Math.max(0, Number(focusedSeconds) || 0) / 60) * 10) / 10;
  if (!Array.isArray(answers) || !answers.some((a) => typeof a === "number")) {
    return NextResponse.json({ error: "Answer at least one question before submitting." }, { status: 400 });
  }

  try {
    const result = gradeQuiz(String(id), answers);
    const row = await getRow(result.row);
    if (!row) return NextResponse.json({ error: "Topic not found in the sheet" }, { status: 404 });

    const passed = result.score >= config.passScore;
    const status = passed ? STATUS.DONE : STATUS.NEEDS_WORK;
    const now = new Date();
    // Retry on the evening of the retry day (a date without a time is read as 19:00).
    const retryDay = localDay(new Date(now.getTime() + config.retryDays * 86_400_000));
    const nextReview = passed ? "" : formatLocal(parseLocal(retryDay)!);
    const advice = passed
      ? "Skim the explanations for anything you missed, then move on to the next topic."
      : "Reread the study guide sections on the topics above, then retake the quiz.";
    const feedback = [result.verdict, result.gaps.length ? `Revise: ${result.gaps.join("; ")}` : "", advice].filter(Boolean).join("\n");

    await updateRow(row.row, { score: String(result.score), status, feedback, nextReview, inviteSentFor: "" });
    await appendHistory([
      formatLocal(now),
      row.topic,
      String(result.score),
      result.verdict,
      feedback,
      result.transcript,
      String(focusedMinutes),
    ]);

    await sendMail({
      subject: `${row.topic} quiz: ${result.score}/10 - ${passed ? "passed" : "needs another round"}`,
      html: renderEmail({
        preheader: result.verdict,
        title: passed ? `You passed the ${row.topic} quiz with ${result.score}/10` : `${row.topic}: ${result.score}/10 - one more round`,
        body: [
          p(`<b>${esc(result.verdict)}</b>`),
          result.strengths.length ? heading("You know") + list(result.strengths.map(esc)) : "",
          result.gaps.length ? heading("Revise these") + list(result.gaps.map(esc)) : "",
          p(`Focused time: <b>${focusedMinutes} min</b>.`),
          p(
            passed
              ? "This topic is now marked <b>Done</b> in your tracker."
              : `It's marked <b>Needs Modification</b>. Your retry is booked for <b>${esc(nextReview)}</b>.`,
          ),
        ].join(""),
        cta: passed
          ? { label: "See your progress", url: `${config.appUrl}/insights` }
          : { label: "Reread the guide", url: `${config.appUrl}/guide/${row.row}` },
        ctaColor: passed ? "#1f8a4c" : undefined,
      }),
    }).catch((error) => console.error("Result email failed", error));

    return NextResponse.json({ ...result, transcript: undefined, status, nextReview });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
