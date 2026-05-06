import { useEffect, useState } from "react";

export type Theme = "night" | "day";
const KEY = "apn-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("day", theme === "day");
  root.classList.toggle("night", theme === "night");
  // Update <body> background to match theme without flash
  document.body.style.backgroundColor = theme === "day" ? "#f5f1ea" : "#03040a";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "night";
    return (localStorage.getItem(KEY) as Theme) || "night";
  });

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "night" ? "day" : "night"));
  return { theme, setTheme, toggle };
}
