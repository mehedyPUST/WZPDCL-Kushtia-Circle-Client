"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      suppressHydrationWarning
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`theme-toggle-btn inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? "h-8 w-8 p-0" : "h-8 px-2.5 text-[12px]"
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {!compact && <span suppressHydrationWarning>Light</span>}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-muted shrink-0" />
          {!compact && <span suppressHydrationWarning>Dark</span>}
        </>
      )}
    </button>
  );
}
