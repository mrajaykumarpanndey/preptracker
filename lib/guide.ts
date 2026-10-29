import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Row } from "./sheets";

// Short study guides, one per topic, written by Claude and cached on disk (data/guides) so each
// topic costs one API call. Shown on /guide/[row] and attached as a PDF to interview invites.
// They serve both goals: understand and build ML models, and do well in interviews.

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const Guide = z.object({
  summary: z.string().describe("What the topic is, in one or two plain sentences"),
  whyItMatters: z.string().describe("One or two sentences on why interviewers ask about it"),
  keyPoints: z
    .array(z.object({ title: z.string(), explanation: z.string().describe("Two or three short sentences") }))
    .describe("Three to six core ideas, most important first"),
  diagram: z
    .object({
      title: z.string(),
      steps: z.array(z.string().describe("Two to six words")).describe("Three to six boxes, read left to right"),
      caption: z.string().describe("One sentence explaining the flow"),
    })
    .nullable()
    .describe("A simple step-by-step flow, only when it genuinely helps understanding; otherwise null"),
  code: z
    .object({
      language: z.string(),
      snippet: z.string().describe("At most 15 short lines, runnable, with brief comments"),
      explanation: z.string().describe("One or two sentences on what the code shows"),
    })
    .nullable()
    .describe("A small example when the topic involves code; otherwise null"),
  inPractice: z.string().describe("Two or three sentences on how this is used when building real ML models or products"),
  buildIt: z
    .object({
      title: z.string().describe("A short name for a hands-on exercise"),
      goal: z.string().describe("One sentence: what you will build or find out"),
      steps: z.array(z.string()).describe("Three to six concrete steps, each one sentence"),
      resources: z.string().describe("Suggested dataset, library or tool - free and easy to get"),
      expected: z.string().describe("What you should see when it works"),
      stretch: z.string().describe("One optional harder extension"),
    })
    .describe("A small exercise doable in 30-60 minutes that builds real skill towards ML projects"),
  pitfalls: z.array(z.string()).describe("Two to four common mistakes, one sentence each"),
  interviewQuestions: z
    .array(z.object({ question: z.string(), answer: z.string().describe("Two to four sentences") }))
    .describe("Three to five likely interview questions with model answers"),
  recap: z.array(z.string()).describe("Three to five one-line takeaways"),
});

export type GuideContent = z.infer<typeof Guide>;
export type Guide = GuideContent & { topic: string; category?: string; generatedAt: string; editedAt?: string };

const guidesDir = () => path.join(process.cwd(), "data", "guides");
const slug = (row: Row) =>
  `${row.category ?? ""}-${row.topic}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const fileFor = (row: Row) => path.join(guidesDir(), `${slug(row)}.json`);

export function cachedGuide(row: Row): Guide | null {
  try {
    return existsSync(fileFor(row)) ? (JSON.parse(readFileSync(fileFor(row), "utf8")) as Guide) : null;
  } catch {
    return null;
  }
}

async function generate(row: Row): Promise<Guide> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(Guide) },
    system: `You write short study guides for someone learning machine learning with two goals:
1) really understand the topic and be able to build ML models and projects with it, and
2) do well in technical interviews about it.
Teach for understanding first, then show how it is used in practice, then give a small hands-on exercise.
Write for a smart beginner: plain words, short sentences, no jargon without a one-line explanation.
The whole guide must fit on about two to three printed pages - be selective, not exhaustive.
Only include a diagram or code when it makes the idea clearer. Use plain ASCII text (no emoji or special arrows).`,
    messages: [
      {
        role: "user",
        content: `Topic: ${row.topic}\n${row.keyPoints}\n\nWrite the study guide for this topic.`,
      },
    ],
  });
  if (!response.parsed_output) throw new Error("Could not generate the study guide.");
  return { ...response.parsed_output, topic: row.topic, category: row.category, generatedAt: new Date().toISOString() };
}

function write(row: Row, guide: Guide): Guide {
  mkdirSync(guidesDir(), { recursive: true });
  writeFileSync(fileFor(row), JSON.stringify(guide, null, 2));
  return guide;
}

/** Saves your edits; the PDF and email attachments are built from this from now on. */
export function saveGuide(row: Row, content: unknown): Guide {
  const parsed = Guide.safeParse(content);
  if (!parsed.success) throw new Error(`The guide is missing something: ${parsed.error.issues[0]?.path.join(".") || "content"}`);
  const previous = cachedGuide(row);
  return write(row, {
    ...parsed.data,
    topic: row.topic,
    category: row.category,
    generatedAt: previous?.generatedAt ?? new Date().toISOString(),
    editedAt: new Date().toISOString(),
  });
}

/** Throws away the saved guide (including edits) and writes a fresh one. */
export async function regenerateGuide(row: Row): Promise<Guide> {
  return write(row, await generate(row));
}

const inFlight = new Map<string, Promise<Guide>>();

/** Returns the topic's guide, generating and caching it the first time. */
export function getGuide(row: Row): Promise<Guide> {
  const cached = cachedGuide(row);
  if (cached) return Promise.resolve(cached);
  const key = slug(row);
  let pending = inFlight.get(key);
  if (!pending) {
    pending = generate(row)
      .then((guide) => write(row, guide))
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Topic context for the interviewer: key points plus the guide's hands-on exercise, if the guide exists. */
export function interviewContext(row: Row): string {
  const exercise = cachedGuide(row)?.buildIt;
  return exercise
    ? `${row.keyPoints}\nHands-on exercise from the study guide: "${exercise.title}" - ${exercise.goal}`
    : row.keyPoints;
}
