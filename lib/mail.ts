import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config";

let transport: Transporter | undefined;

export async function sendMail(opts: { subject: string; html: string; ics?: string }): Promise<void> {
  // Preview mode for development: write the email to a file instead of sending it.
  const previewDir = process.env.MAIL_PREVIEW_DIR;
  if (previewDir) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(previewDir, { recursive: true });
    const name = `${Date.now()}-${opts.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.html`;
    writeFileSync(`${previewDir}/${name}`, opts.html);
    return;
  }
  transport ??= nodemailer.createTransport(config.smtp);
  await transport.sendMail({
    from: config.mailFrom,
    to: config.notifyEmail,
    subject: opts.subject,
    html: opts.html,
    // Gmail/Outlook show this as a calendar invite with Yes/No/Maybe buttons.
    icalEvent: opts.ics ? { method: "REQUEST", content: opts.ics } : undefined,
  });
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function buildInvite(opts: {
  uid: string;
  start: Date;
  minutes: number;
  title: string;
  description: string;
  url: string;
}): string {
  const end = new Date(opts.start.getTime() + opts.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Prep Tracker//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(opts.title)}`,
    `DESCRIPTION:${icsText(`${opts.description}\n\nJoin: ${opts.url}`)}`,
    `URL:${opts.url}`,
    `LOCATION:${icsText(opts.url)}`,
    `ORGANIZER:mailto:${config.smtp.auth.user}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${config.notifyEmail}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview starts in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
