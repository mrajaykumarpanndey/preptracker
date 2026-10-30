import { createEvent, deleteEvent } from "./calendar";
import { config } from "./config";
import { REVIEWABLE, STATUS } from "./constants";
import { oauthConnected } from "./google";
import { esc, heading, list, p, progressBar, renderEmail, schedule } from "./emailTemplate";
import { getGuide } from "./guide";
import { renderGuidePdf } from "./guidePdf";
import { buildInvite, sendMail } from "./mail";
import { listRows, updateRows, type Row, type RowUpdate } from "./store";
import { formatLocal, localDay, localHour } from "./time";
import { clock, currentStudyDay, dueDate, quizStart, planDays, type Kind } from "./timetable";

export { dueDate };

const HOUR = 3_600_000;

export function quizUrl(row: Row): string {
  return `${config.appUrl}/quiz/${row.row}`;
}

/**
 * Schedules the quiz and returns the value stored in "Invite Sent For": "<due time>|<calendar event id>".
 * With Google connected it creates a real Google Calendar event; otherwise it emails an .ics invite.
 */
export async function sendInvite(row: Row, start: Date, dueKey: string): Promise<string> {
  const url = quizUrl(row);
  const event = {
    title: `Quiz: ${row.topic}`,
    description: `Multiple-choice quiz on your study guide for "${row.topic}".`,
    start,
    minutes: config.quizMinutes,
    url,
  };

  let eventId = "";
  if (oauthConnected()) {
    const previousEventId = row.inviteSentFor.split("|")[1];
    if (previousEventId) await deleteEvent(previousEventId); // the due time was moved
    eventId = await createEvent(event);
  }

  const when = formatLocal(start);
  const guideUrl = `${config.appUrl}/guide/${row.row}`;
  // The study guide goes along as a PDF; if it can't be written right now the invite still goes out.
  let guidePdf: Buffer | undefined;
  try {
    guidePdf = await renderGuidePdf(await getGuide(row), { phase: row.phase });
  } catch (error) {
    console.error(`Study guide for "${row.topic}" failed`, error);
  }
  await sendMail({
    subject: `Quiz: ${row.topic} at ${when.slice(11)} on ${when.slice(0, 10)}`,
    html: renderEmail({
      preheader: `Your ${config.quizMinutes}-minute quiz on ${row.topic} is booked for ${when}.`,
      title: `Your quiz on ${row.topic}`,
      body: [
        p(
          `It's booked for <b>${esc(when)}</b> (${config.quizMinutes} minutes)${
            eventId ? " and is in your Google Calendar" : ". Accept the attached invite to add it to your calendar"
          }.`,
        ),
        p("It's a multiple-choice quiz written from your study guide, with an explanation for every answer once you submit. Your score goes straight into your tracker."),
        heading("Get ready"),
        p(
          `${guidePdf ? "Your <b>study guide is attached as a PDF</b>" : "Your study guide is ready online"}: key ideas, a diagram or code example, a small hands-on build exercise, and the questions you're likely to get. <a href="${guideUrl}" style="color:#2a63d6">Read it online</a>.`,
        ),
      ].join(""),
      cta: { label: "Start the quiz", url },
    }),
    ics: eventId ? undefined : buildInvite({ uid: `prep-${row.row}-${start.getTime()}@prep-tracker`, ...event }),
    attachments: guidePdf
      ? [{ filename: `Study guide - ${row.topic.replace(/[^\w ,.-]+/g, "")}.pdf`, content: guidePdf }]
      : undefined,
  });
  return eventId ? `${dueKey}|${eventId}` : dueKey;
}

type DigestItem = { row: Row; due: Date; overdue: boolean };

const DIGEST_LIMIT = 15;

const SESSION: Record<Kind, { label: string; color: string }> = {
  study: { label: "Study", color: "#2a78d6" },
  retry: { label: "Revise & retry", color: "#c53030" },
  ahead: { label: "Get ahead", color: "#1c4f9c" },
  quiz: { label: "Quiz", color: "#c4511f" },
};

/** Today's sessions - the same plan the dashboard board shows. */
function timetableHtml(rows: Row[], today: string): string {
  const [plan] = planDays(rows, today, 1);
  if (plan.blocks.length === 0) return "";
  const rowsHtml = schedule(
    [...plan.blocks]
      .sort((a, b) => a.start - b.start)
      .map((b) => ({
        time: `${clock(b.start)}-${clock(b.end)}`,
        color: SESSION[b.kind].color,
        title: b.kind === "quiz" || !b.note ? b.topic : `${b.note}: ${b.topic}`,
        subtitle: [SESSION[b.kind].label, b.category].filter(Boolean).join(" · "),
        href: `${config.appUrl}/${b.kind === "quiz" ? "quiz" : "guide"}/${b.row}`,
      })),
  );
  const more = plan.more > 0 ? p(`<span style="color:#8a8f98">+${plan.more} more topics due today - see the tracker.</span>`) : "";
  return heading("Today's timetable") + rowsHtml + more;
}

async function sendDigest(items: DigestItem[], rows: Row[], now: Date): Promise<void> {
  const line = ({ row, due, overdue }: DigestItem) => {
    const status = row.status || STATUS.NOT_STARTED;
    const action = REVIEWABLE.includes(status)
      ? `<a href="${quizUrl(row)}" style="color:#2a63d6">take the quiz</a>`
      : `set it to "${STATUS.IN_PROGRESS}" when you start`;
    const category = row.category ? ` <span style="color:#8a8f98">(${esc(row.category)})</span>` : "";
    return `<b>${esc(row.topic)}</b>${category}<br><span style="font-size:14px">${overdue ? '<b style="color:#c53030">Overdue</b> since' : "Due"} ${esc(
      formatLocal(due),
    )}${row.score ? ` · last score ${esc(row.score)}/10` : ""} · ${action}</span>`;
  };
  const overdue = items.filter((i) => i.overdue).length;
  const done = rows.filter((r) => r.status === STATUS.DONE).length;
  const sorted = [...items].sort((a, b) => a.due.getTime() - b.due.getTime());
  const more = sorted.length - DIGEST_LIMIT;
  const studyDay = currentStudyDay(now).day;
  const sessions = planDays(rows, studyDay, 1)[0].blocks.filter((b) => b.kind !== "quiz").length;

  await sendMail({
    subject: `Today's plan: ${sessions} session${sessions === 1 ? "" : "s"}${overdue ? `, ${overdue} overdue` : ""}`,
    html: renderEmail({
      preheader: `${sessions} study sessions today. ${done} of ${rows.length} topics done so far.`,
      title: overdue ? `${overdue} topic${overdue === 1 ? "" : "s"} to catch up on - you've got this` : "Here's your plan for today",
      body: [
        progressBar(done, rows.length),
        timetableHtml(rows, studyDay),
        heading("Due and overdue"),
        list(sorted.slice(0, DIGEST_LIMIT).map(line)),
        more > 0 ? p(`<span style="color:#8a8f98">...and ${more} more in your tracker.</span>`) : "",
      ].join(""),
      cta: { label: "Open today's timetable", url: config.appUrl },
    }),
  });
}

/** One pass: send quiz invites that are due and a once-a-day reminder digest. Safe to run every few minutes. */
export async function runScheduler(now = new Date()) {
  const rows = await listRows();
  const today = localDay(now);
  const invited: string[] = [];
  const digest: DigestItem[] = [];
  const updates: RowUpdate[] = [];

  for (const row of rows) {
    if (row.status === STATUS.DONE) continue;
    const due = dueDate(row);
    if (!due) continue;
    const hoursLeft = (due.getTime() - now.getTime()) / HOUR;
    const dueKey = formatLocal(due);

    // The invite is keyed by the due time, so moving the date in the sheet sends a fresh invite.
    // It's booked at the topic's evening slot from the timetable (19:00, 19:30, ...).
    if (
      REVIEWABLE.includes(row.status) &&
      hoursLeft <= config.inviteHoursBefore &&
      hoursLeft > -12 &&
      row.inviteSentFor.split("|")[0] !== dueKey
    ) {
      const start = quizStart(rows, row) ?? due;
      updates.push({ row: row.row, fields: { inviteSentFor: await sendInvite(row, start, dueKey) } });
      invited.push(row.topic);
    }

    if (hoursLeft <= config.remindHoursBefore && row.lastReminder !== today) {
      digest.push({ row, due, overdue: hoursLeft < 0 });
    }
  }

  const sendDigestNow = digest.length > 0 && localHour(now) >= config.digestHour;
  if (sendDigestNow) {
    await sendDigest(digest, rows, now);
    for (const { row } of digest) {
      const existing = updates.find((u) => u.row === row.row);
      if (existing) existing.fields.lastReminder = today;
      else updates.push({ row: row.row, fields: { lastReminder: today } });
    }
  }
  await updateRows(updates);

  return { checked: rows.length, invited, reminded: sendDigestNow ? digest.map((d) => d.row.topic) : [] };
}
