import { createEvent, deleteEvent } from "./calendar";
import { config } from "./config";
import { REVIEWABLE, STATUS } from "./constants";
import { oauthConnected } from "./google";
import { buildInvite, escapeHtml, sendMail } from "./mail";
import { listRows, updateRows, type Row, type RowUpdate } from "./store";
import { formatLocal, localDay, localHour, parseLocal } from "./time";

const HOUR = 3_600_000;

export function dueDate(row: Row): Date | null {
  return parseLocal(row.nextReview) ?? parseLocal(row.planned);
}

export function interviewUrl(row: Row): string {
  return `${config.appUrl}/interview/${row.row}`;
}

/**
 * Schedules the interview and returns the value stored in "Invite Sent For": "<due time>|<calendar event id>".
 * With Google connected it creates a real Google Calendar event; otherwise it emails an .ics invite.
 */
export async function sendInvite(row: Row, start: Date, dueKey: string): Promise<string> {
  const url = interviewUrl(row);
  const event = {
    title: `Mock interview: ${row.topic}`,
    description: `AI interview to check your preparation on "${row.topic}".`,
    start,
    minutes: config.interviewMinutes,
    url,
  };

  let eventId = "";
  if (oauthConnected()) {
    const previousEventId = row.inviteSentFor.split("|")[1];
    if (previousEventId) await deleteEvent(previousEventId); // the due time was moved
    eventId = await createEvent(event);
  }

  await sendMail({
    subject: `Interview scheduled: ${row.topic} at ${formatLocal(start)}`,
    html: `<p>Your mock interview on <b>${escapeHtml(row.topic)}</b> is scheduled for <b>${formatLocal(start)}</b>${
      eventId ? " and has been added to your Google Calendar" : ""
    }.</p>
<p><a href="${url}">Start the interview</a> when you're ready.</p>
${row.keyPoints ? `<p>Revise these points first:<br>${escapeHtml(row.keyPoints).replace(/\n/g, "<br>")}</p>` : ""}`,
    ics: eventId ? undefined : buildInvite({ uid: `prep-${row.row}-${start.getTime()}@prep-tracker`, ...event }),
  });
  return eventId ? `${dueKey}|${eventId}` : dueKey;
}

type DigestItem = { row: Row; due: Date; overdue: boolean };

const DIGEST_LIMIT = 15;

async function sendDigest(items: DigestItem[], rows: Row[]): Promise<void> {
  const line = ({ row, due, overdue }: DigestItem) => {
    const status = row.status || STATUS.NOT_STARTED;
    const action = REVIEWABLE.includes(status)
      ? `<a href="${interviewUrl(row)}">take the interview</a>`
      : `update the status to "${STATUS.IN_PROGRESS}" or "${STATUS.READY}" once you start`;
    const category = row.category ? ` <span style="color:#888">(${escapeHtml(row.category)})</span>` : "";
    return `<li><b>${escapeHtml(row.topic)}</b>${category} - ${escapeHtml(status)}, ${overdue ? "<b>overdue</b> since" : "due"} ${formatLocal(due)}${
      row.score ? `, last score ${escapeHtml(row.score)}/10` : ""
    }<br>Next step: ${action}</li>`;
  };
  const overdue = items.filter((i) => i.overdue).length;
  const done = rows.filter((r) => r.status === STATUS.DONE).length;
  const sorted = [...items].sort((a, b) => a.due.getTime() - b.due.getTime());
  const more = sorted.length - DIGEST_LIMIT;
  await sendMail({
    subject: `Prep check-in: ${items.length} topic(s) need attention${overdue ? `, ${overdue} overdue` : ""}`,
    html: `<p>Progress: <b>${done} of ${rows.length}</b> topics done (${Math.round((done / Math.max(rows.length, 1)) * 100)}%).</p>
<p>Here's what you need to work on:</p><ul>${sorted.slice(0, DIGEST_LIMIT).map(line).join("")}</ul>
${more > 0 ? `<p>...and ${more} more.</p>` : ""}
<p><a href="${config.appUrl}">Open your tracker</a></p>`,
  });
}

/** One pass: send interview invites that are due and a once-a-day reminder digest. Safe to run every few minutes. */
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
    if (
      REVIEWABLE.includes(row.status) &&
      hoursLeft <= config.inviteHoursBefore &&
      hoursLeft > -12 &&
      row.inviteSentFor.split("|")[0] !== dueKey
    ) {
      updates.push({ row: row.row, fields: { inviteSentFor: await sendInvite(row, due, dueKey) } });
      invited.push(row.topic);
    }

    if (hoursLeft <= config.remindHoursBefore && row.lastReminder !== today) {
      digest.push({ row, due, overdue: hoursLeft < 0 });
    }
  }

  const sendDigestNow = digest.length > 0 && localHour(now) >= config.digestHour;
  if (sendDigestNow) {
    await sendDigest(digest, rows);
    for (const { row } of digest) {
      const existing = updates.find((u) => u.row === row.row);
      if (existing) existing.fields.lastReminder = today;
      else updates.push({ row: row.row, fields: { lastReminder: today } });
    }
  }
  await updateRows(updates);

  return { checked: rows.length, invited, reminded: sendDigestNow ? digest.map((d) => d.row.topic) : [] };
}
