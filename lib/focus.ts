import type { HistoryEntry, StudySession } from "./store";
import { currentStudyDay, FIRST_HOUR, LAST_HOUR } from "./timetable";

// Focus statistics from reading sessions (Study Log) and quizzes (History), shared by the
// Progress and Focus pages. Times after midnight count towards the evening before.

export type FocusEvent = { when: string; topic: string; minutes: number; kind: "reading" | "quiz"; readPercent?: number };

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function focusStats(study: StudySession[], history: HistoryEntry[], days = 14) {
  const events: FocusEvent[] = [
    ...study.map((s) => ({ when: s.started, topic: s.topic, minutes: s.minutes, kind: "reading" as const, readPercent: s.readPercent })),
    ...history
      .filter((h) => h.minutes)
      .map((h) => ({ when: h.date, topic: h.topic, minutes: h.minutes!, kind: "quiz" as const })),
  ]
    .filter((e) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(e.when))
    .sort((a, b) => b.when.localeCompare(a.when));

  const studyDayOf = (when: string) =>
    Number(when.slice(11, 13)) < LAST_HOUR - 24 ? addDays(when.slice(0, 10), -1) : when.slice(0, 10);
  const { day: today } = currentStudyDay();
  const sum = (list: FocusEvent[]) => list.reduce((s, e) => s + e.minutes, 0);

  const perDay = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1))).map((day) => {
    const onDay = events.filter((e) => studyDayOf(e.when) === day);
    return {
      day,
      reading: sum(onDay.filter((e) => e.kind === "reading")),
      quiz: sum(onDay.filter((e) => e.kind === "quiz")),
    };
  });
  const byHour = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i).map((hour) => ({
    hour,
    minutes: sum(events.filter((e) => Number(e.when.slice(11, 13)) === hour % 24)),
  }));
  const topicTotals = [...new Set(events.map((e) => e.topic))]
    .map((topic) => {
      const mine = events.filter((e) => e.topic === topic);
      return {
        topic,
        reading: sum(mine.filter((e) => e.kind === "reading")),
        quiz: sum(mine.filter((e) => e.kind === "quiz")),
        read: Math.max(0, ...mine.map((e) => e.readPercent ?? 0)),
      };
    })
    .sort((a, b) => b.reading + b.quiz - (a.reading + a.quiz));
  const last = perDay[perDay.length - 1];
  let streak = 0;
  for (let i = perDay.length - 1; i >= 0 && perDay[i].reading + perDay[i].quiz > 0; i--) streak++;

  return {
    events,
    perDay,
    byHour,
    topicTotals,
    todayMinutes: last.reading + last.quiz,
    weekMinutes: perDay.slice(-7).reduce((s, d) => s + d.reading + d.quiz, 0),
    guidesRead: new Set(study.filter((s) => s.readPercent >= 80).map((s) => s.topic)).size,
    streak,
  };
}

export const minutesLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
