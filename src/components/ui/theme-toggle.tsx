"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Theme = "light" | "dark";

// Toggles an explicit light/dark class on <html> and remembers the choice. Falls back to the OS
// preference for the initial icon when nothing is stored.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) setTheme(stored);
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    localStorage.setItem("theme", next);
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      aria-label="Toggle theme"
      className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
    >
      <span className="tnum">{theme === "dark" ? "Dark" : "Light"}</span>
      <span className="ml-auto text-xs text-muted">click to switch</span>
    </motion.button>
  );
}
