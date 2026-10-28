import { config } from "./config";
import { googleRequest } from "./google";

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Creates an event in your Google Calendar and returns its id. NOTIFY_EMAIL is invited if it's another address. */
export async function createEvent(opts: {
  title: string;
  description: string;
  start: Date;
  minutes: number;
  url: string;
}): Promise<string> {
  const end = new Date(opts.start.getTime() + opts.minutes * 60_000);
  const event = await googleRequest<{ id: string }>(`${EVENTS}?sendUpdates=all`, "POST", {
    summary: opts.title,
    description: `${opts.description}\n\nJoin: ${opts.url}`,
    location: opts.url,
    start: { dateTime: opts.start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: [{ email: config.notifyEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 15 },
        { method: "email", minutes: 60 },
      ],
    },
  });
  return event.id;
}

export async function deleteEvent(id: string): Promise<void> {
  await googleRequest(`${EVENTS}/${encodeURIComponent(id)}?sendUpdates=all`, "DELETE").catch((error) =>
    console.error(`Could not delete old calendar event ${id}`, error),
  );
}
