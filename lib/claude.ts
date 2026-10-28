import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { END_MARKER, type ChatTurn } from "./constants";

const MODEL = "claude-opus-5-5";

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

function interviewerPrompt(topic: string, keyPoints: string): string {
  return `You are a strict but encouraging technical interviewer helping a candidate prepare for job placement.

Topic: ${topic}
Key points the candidate is expected to know:
${keyPoints || "(none listed - use your judgement about what interviewers usually ask on this topic)"}

How to run the interview:
- Ask one question at a time and wait for the answer.
- Start with fundamentals, then go deeper based on the answers. Mix conceptual, practical ("how would you...") and scenario questions.
- If an answer is vague or wrong, ask one short follow-up to probe before moving on. Don't teach or reveal answers during the interview - feedback comes afterwards.
- Cover the key points across roughly 6-8 questions.
- Keep each message short, like a real interviewer speaking. Write plain conversational text: no headings or "Question 1:" labels. Use \`backticks\` only for code, and a fenced code block only when showing code.
- When you have enough signal, thank the candidate and end that message with ${END_MARKER} on its own line.`;
}

function textOf(content: { type: string; text?: string }[]): string {
  return content.flatMap((block) => (block.type === "text" && block.text ? [block.text] : [])).join("\n").trim();
}

export async function nextInterviewTurn(topic: string, keyPoints: string, turns: ChatTurn[]): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // If a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: interviewerPrompt(topic, keyPoints),
    messages: [{ role: "user", content: "I'm ready. Please start the interview." }, ...turns],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The interviewer declined to continue. Try rephrasing your last answer.");
  }
  return textOf(response.content);
}

const Evaluation = z.object({
  score: z.number().describe("Overall score from 0 to 10"),
  verdict: z.string().describe("One sentence summary of readiness"),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()).describe("Specific concepts the candidate must revise"),
  feedback: z.string().describe("Short, actionable advice on what to study next"),
});

export type Evaluation = z.infer<typeof Evaluation>;

export async function evaluateInterview(topic: string, keyPoints: string, turns: ChatTurn[]): Promise<Evaluation> {
  const transcript = turns
    .map((t) => `${t.role === "assistant" ? "Interviewer" : "Candidate"}: ${t.content.replace(END_MARKER, "")}`)
    .join("\n\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(Evaluation) },
    system:
      "You grade mock interviews for placement preparation. Be honest and calibrated: 9-10 means ready for a real interview, 7-8 solid with minor gaps, 4-6 partial understanding, 0-3 not prepared. Judge only what the candidate actually said; unanswered key points count as gaps.",
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\nExpected key points:\n${keyPoints || "(not specified)"}\n\n<transcript>\n${transcript}\n</transcript>`,
      },
    ],
  });
  if (!response.parsed_output) throw new Error("Could not score the interview. Please try again.");
  const result = response.parsed_output;
  return { ...result, score: Math.max(0, Math.min(10, Math.round(result.score * 10) / 10)) };
}
