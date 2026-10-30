// Shared between server and browser code - no secrets or env access here.

export const STATUS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  READY: "Ready for Review",
  NEEDS_WORK: "Needs Modification",
  DONE: "Done",
} as const;

// Statuses that mean "I've studied this, test me when the time comes".
export const REVIEWABLE: string[] = [STATUS.IN_PROGRESS, STATUS.READY, STATUS.NEEDS_WORK];

// A guide counts as read once you've scrolled through this much of it; its quiz is then unlocked.
export const READ_COMPLETE = 90;

/** A quiz question as the browser sees it - the answer stays on the server until you submit. */
export type QuizQuestion = { concept: string; question: string; code: string; options: string[] };

/** One question's outcome, returned after grading. */
export type QuizReview = { chosen: number | null; answer: number; correct: boolean; explanation: string };
