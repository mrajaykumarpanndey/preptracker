import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { END_MARKER, type ChatTurn, type InterviewerView } from "./constants";

const MODEL = "claude-opus-5-5";

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

function interviewerPrompt(topic: string, keyPoints: string): string {
  return `You are a strict but encouraging technical interviewer and mentor. The candidate is learning machine learning with two goals: being able to build real ML models and projects, and doing well in job interviews. Test both.

Topic: ${topic}
Context and key points:
${keyPoints || "(none listed - use your judgement about what matters for this topic)"}

How to run the interview:
- Ask one question at a time and wait for the answer.
- Start with fundamentals, then go deeper based on the answers.
- About half the questions should test understanding (what, why, trade-offs) and half should test building and applying: write or fix a few lines of code, "how would you build/implement...", "your model does X - what do you check?", or choosing an approach for a realistic ML task.
- If a hands-on exercise is listed above, ask what they built or observed doing it.
- If the candidate asks for a hint, give one small nudge without the answer, then let them try. If they ask you to rephrase, rephrase the same question more simply. If they ask you to explain the question in more detail, explain what you are asking and why, define any terms in it, and give a small concrete scenario or example input - without revealing the answer - then ask the same question again. If they skip, acknowledge briefly and move to the next question.
- If an answer is vague or wrong, ask one short follow-up to probe before moving on. Don't teach or reveal answers during the interview - feedback comes afterwards.
- Cover the key points across roughly 6-8 questions.
- Keep each message short, like a real interviewer speaking. Use \`backticks\` for code and a fenced code block when showing more than one line of code.

Every reply is split into fields:
- reaction: at most one short sentence reacting to the candidate's last message (empty for the very first question). Don't reveal answers.
- context: optional setup the question needs - a scenario, a code snippet in a fenced block, or the hint/explanation they asked for. Empty if not needed.
- question: the one main question, in one or two sentences. Never put the question inside context.
- parts: if you want two or three specific things answered, list them here as short sub-questions (and keep "question" as the overall ask); otherwise empty.
- followUp: true when this re-asks, probes or narrows the previous question (including after a hint or explanation) rather than starting a new one.
- done: true only when you have enough signal to finish; then put a short thank-you in "question" and leave parts empty.`;
}

const InterviewerTurn = z.object({
  reaction: z.string(),
  context: z.string(),
  question: z.string(),
  parts: z.array(z.string()),
  followUp: z.boolean(),
  done: z.boolean(),
});

/** The same message as plain text - kept in the transcript the interviewer and grader read. */
export function viewToText(view: InterviewerView): string {
  const parts = view.parts.map((p, i) => `(${String.fromCharCode(97 + i)}) ${p}`).join("\n");
  return [view.reaction, view.context, view.question, parts, view.done ? END_MARKER : ""].filter(Boolean).join("\n\n");
}

export async function nextInterviewTurn(
  topic: string,
  keyPoints: string,
  turns: ChatTurn[],
): Promise<{ text: string; view: InterviewerView }> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(InterviewerTurn) },
    system: interviewerPrompt(topic, keyPoints),
    messages: [
      { role: "user", content: "I'm ready. Please start the interview." },
      ...turns.map(({ role, content }) => ({ role, content })),
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("The interviewer couldn't continue. Try rephrasing your last answer.");
  }
  const view = response.parsed_output;
  return { text: viewToText(view), view };
}

const Evaluation = z.object({
  score: z.number().describe("Overall score from 0 to 10"),
  understanding: z.number().describe("0-10: explains concepts, reasons about why and trade-offs"),
  application: z.number().describe("0-10: can write, debug or design working code and ML solutions"),
  verdict: z.string().describe("One sentence summary of readiness"),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()).describe("Specific concepts the candidate must revise"),
  feedback: z.string().describe("Short, actionable advice on what to study next"),
  buildNext: z.string().describe("One small, concrete thing to build next (30-60 minutes) to strengthen the weakest area"),
});

export type Evaluation = z.infer<typeof Evaluation>;

export async function evaluateInterview(topic: string, keyPoints: string, turns: ChatTurn[]): Promise<Evaluation> {
  const transcript = turns
    .map((t) => ({ ...t, content: t.view ? viewToText(t.view) : t.content }))
    .map((t) => `${t.role === "assistant" ? "Interviewer" : "Candidate"}: ${t.content.replace(END_MARKER, "")}`)
    .join("\n\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(Evaluation) },
    system:
      "You grade mock interviews for someone learning to build ML models and to pass technical interviews. Score understanding (explaining concepts, why, trade-offs) and application (writing, debugging or designing working solutions) separately, then give an overall score. Be honest and calibrated: 9-10 means ready for a real interview and able to build with it, 7-8 solid with minor gaps, 4-6 partial, 0-3 not prepared. Judge only what the candidate actually said; unanswered points count as gaps. Needing hints lowers the score a little; skipped questions count as not answered.",
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\nExpected key points:\n${keyPoints || "(not specified)"}\n\n<transcript>\n${transcript}\n</transcript>`,
      },
    ],
  });
  if (!response.parsed_output) throw new Error("Could not score the interview. Please try again.");
  const result = response.parsed_output;
  const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10));
  return { ...result, score: clamp(result.score), understanding: clamp(result.understanding), application: clamp(result.application) };
}
