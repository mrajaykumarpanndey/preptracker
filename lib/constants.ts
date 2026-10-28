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

// The interviewer puts this on its last message when it has enough signal to score.
export const END_MARKER = "[[INTERVIEW_COMPLETE]]";

export type ChatTurn = { role: "user" | "assistant"; content: string };
