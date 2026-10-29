"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "./themeScript";

type Theme = "light" | "dark" | "auto";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  };

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {(["light", "dark", "auto"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          className={theme === t ? "active" : undefined}
          onClick={() => choose(t)}
          title={t === "auto" ? "Follow your system setting" : `${t[0].toUpperCase()}${t.slice(1)} mode`}
        >
          {t === "light" ? "☀︎ Light" : t === "dark" ? "☾ Dark" : "Auto"}
        </button>
      ))}
    </div>
  );
}
