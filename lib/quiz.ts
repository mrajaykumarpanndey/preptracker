import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { QuizQuestion, QuizReview } from "./constants";
import { getGuide, type Guide } from "./guide";
import type { Row, StudySession } from "./store";

// Multiple-choice quizzes written from a topic's study guide. Each attempt gets fresh questions; the
// quiz (with its answers) waits in data/quizzes until you submit, so the browser never sees the key.

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const QUESTIONS = 10;

const Quiz = z.object({
  questions: z
    .array(
      z.object({
        concept: z.string().describe("The idea from the guide this tests, in two to five words"),
        question: z.string().describe("One or two sentences; may refer to the code"),
        code: z.string().describe("A short code snippet the question is about, or empty"),
        options: z.array(z.string()).describe("Exactly four answer options, one correct"),
        answer: z.number().int().describe("Index (0-3) of the correct option"),
        explanation: z.string().describe("Two or three sentences on why the answer is right and the others are not"),
      }),
    )
    .describe(`${QUESTIONS} questions`),
});

type StoredQuiz = { id: string; row: number; topic: string; createdAt: string; questions: z.infer<typeof Quiz>["questions"] };

const quizzesDir = () => path.join(process.cwd(), "data", "quizzes");
const fileFor = (id: string) => path.join(quizzesDir(), `${id}.json`);

function guideText(guide: Guide): string {
  return JSON.stringify(
    {
      summary: guide.summary,
      keyPoints: guide.keyPoints,
      diagram: guide.diagram,
      code: guide.code,
      inPractice: guide.inPractice,
      buildIt: guide.buildIt,
      pitfalls: guide.pitfalls,
      interviewQuestions: guide.interviewQuestions,
      recap: guide.recap,
    },
    null,
    2,
  );
}

/** Writes a new quiz for the topic and returns it without the answers. */
export async function createQuiz(row: Row): Promise<{ id: string; questions: QuizQuestion[] }> {
  const guide = await getGuide(row);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(Quiz) },
    system: `You write multiple-choice quizzes that check whether someone understood a study guide they just read.
Ask only about what the guide covers. Mix recall with understanding: about half the questions should ask why, compare options, predict what code does, or pick the right approach for a small realistic ML scenario.
Each question has exactly four options of similar length; wrong options should be plausible mistakes (the guide's pitfalls are good sources), never jokes. Vary the position of the correct option.
Cover different key points - don't ask two questions about the same idea. Use plain ASCII text.`,
    messages: [
      {
        role: "user",
        content: `Topic: ${row.topic}\n\n<study_guide>\n${guideText(guide)}\n</study_guide>\n\nWrite a ${QUESTIONS}-question quiz on this guide. Make it different from earlier attempts (seed ${randomUUID().slice(0, 8)}).`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Could not write the quiz. Please try again.");

  const questions = response.parsed_output.questions.filter(
    (q) => q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4,
  );
  if (questions.length < 3) throw new Error("The quiz came out incomplete. Please try again.");

  const quiz: StoredQuiz = { id: randomUUID(), row: row.row, topic: row.topic, createdAt: new Date().toISOString(), questions };
  mkdirSync(quizzesDir(), { recursive: true });
  writeFileSync(fileFor(quiz.id), JSON.stringify(quiz, null, 2));
  return { id: quiz.id, questions: questions.map(({ concept, question, code, options }) => ({ concept, question, code, options })) };
}

export type QuizResult = {
  score: number;
  correct: number;
  total: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  review: QuizReview[];
};

/** Marks your answers (null = skipped), deletes the stored quiz and returns the score out of 10. */
export function gradeQuiz(id: string, answers: (number | null)[]): QuizResult & { row: number; transcript: string } {
  if (!/^[\w-]{36}$/.test(id) || !existsSync(fileFor(id))) throw new Error("This quiz has expired. Start a new one.");
  const quiz = JSON.parse(readFileSync(fileFor(id), "utf8")) as StoredQuiz;

  const review = quiz.questions.map((q, i) => {
    const given = answers[i];
    const chosen = typeof given === "number" ? given : null;
    return { chosen, answer: q.answer, correct: chosen === q.answer, explanation: q.explanation };
  });
  const letter = (n: number | null) => (n === null ? "skipped" : String.fromCharCode(65 + n));
  const transcript = quiz.questions
    .map((q, i) => `Q${i + 1}: ${q.question}\nYou: ${letter(review[i].chosen)} · Answer: ${letter(q.answer)} (${q.options[q.answer]})`)
    .join("\n\n");
  const correct = review.filter((r) => r.correct).length;
  const total = quiz.questions.length;
  const score = Math.round((correct / total) * 100) / 10;
  const concepts = (right: boolean) => [...new Set(quiz.questions.filter((_, i) => review[i].correct === right).map((q) => q.concept))];
  const verdict =
    score >= 9 ? "You know this guide well." : score >= 7 ? "Solid - just a few gaps to tidy up." : score >= 4 ? "Partly there - reread the parts you missed." : "Not there yet - go through the guide again before retrying.";

  rmSync(fileFor(id), { force: true });
  return {
    row: quiz.row,
    score,
    correct,
    total,
    verdict: `${correct}/${total} correct. ${verdict}`,
    strengths: concepts(true),
    gaps: concepts(false),
    review,
    transcript,
  };
}

/** How far you've read each topic's guide: the furthest any reading session got, by topic. */
export function readProgress(study: StudySession[]): Map<string, number> {
  const read = new Map<string, number>();
  for (const s of study) read.set(s.topic, Math.max(read.get(s.topic) ?? 0, s.readPercent));
  return read;
}
