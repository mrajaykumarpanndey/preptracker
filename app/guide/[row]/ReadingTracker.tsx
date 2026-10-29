"use client";

import { useEffect, useRef, useState } from "react";
import { duration, useFocusTimer } from "../../useFocusTimer";

const SAVE_EVERY_MS = 30_000;

/** Furthest point of the guide you've scrolled to, as a percentage of the article. */
function readPercent(): number {
  const article = document.querySelector(".guide") as HTMLElement | null;
  if (!article) return 0;
  const end = article.offsetTop + article.offsetHeight;
  const seen = window.scrollY + window.innerHeight;
  return Math.max(0, Math.min(100, Math.round(((seen - article.offsetTop) / Math.max(end - article.offsetTop, 1)) * 100)));
}

/** Focus timer + scroll progress for a study guide, saved to the Study Log while you read. */
export default function ReadingTracker({ row }: { row: number }) {
  const timer = useFocusTimer(false);
  const [read, setRead] = useState(0);
  const state = useRef({ session: "", startedAt: 0, seconds: 0, read: 0, savedSeconds: 0 });
  state.current.seconds = timer.seconds;
  state.current.read = read;

  useEffect(() => {
    state.current.session = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    state.current.startedAt = Date.now();

    const onScroll = () => setRead((r) => Math.max(r, readPercent()));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const payload = () =>
      JSON.stringify({
        session: state.current.session,
        row,
        startedAt: state.current.startedAt,
        focusedSeconds: state.current.seconds,
        readPercent: state.current.read,
      });
    const save = (leaving: boolean) => {
      if (state.current.seconds === state.current.savedSeconds) return; // nothing new
      state.current.savedSeconds = state.current.seconds;
      if (leaving && navigator.sendBeacon) {
        navigator.sendBeacon("/api/study", new Blob([payload()], { type: "application/json" }));
      } else {
        fetch("/api/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload(), keepalive: true }).catch(
          () => (state.current.savedSeconds = -1), // retry on the next tick
        );
      }
    };
    const interval = setInterval(() => save(false), SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && save(true);
    const onLeave = () => save(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      save(true);
      clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [row]);

  return (
    <>
      <div className="read-progress" aria-hidden>
        <i style={{ width: `${read}%` }} />
      </div>
      <div className={`focus-timer reading-pill ${timer.focused ? "" : "paused"}`} title="Counts only while this tab is open and focused">
        <span className="focus-dot" aria-hidden />
        <b>{duration(timer.seconds)}</b>
        <span className="muted">focused</span>
        <span className="muted">· {read}% read</span>
        {!timer.focused && <span className="paused-badge">Paused</span>}
      </div>
    </>
  );
}
