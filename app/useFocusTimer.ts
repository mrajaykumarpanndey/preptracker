"use client";

import { useEffect, useState } from "react";

export const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
};

/**
 * Seconds this page has had your attention: counts only while the tab is visible and the window focused.
 * Stops for good once `stopped` is true.
 */
export function useFocusTimer(stopped: boolean) {
  const [seconds, setSeconds] = useState(0);
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    if (stopped) return;
    const tick = () => {
      const active = document.visibilityState === "visible" && document.hasFocus();
      setFocused(active);
      if (active) setSeconds((s) => s + 1);
    };
    const id = setInterval(tick, 1000);
    const update = () => setFocused(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [stopped]);
  return { seconds, focused: focused && !stopped };
}
