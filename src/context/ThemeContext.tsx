"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "wzpdcl-theme-choice";
const LEGACY_STORAGE_KEY = "wzpdcl-theme";
const THEME_EVENT = "wzpdcl-theme-change";

const ThemeContext = createContext({
  theme: "dark",
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {},
});

function readSavedChoice() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function getSystemTheme() {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

function readClientTheme() {
  const saved = readSavedChoice();
  if (saved) return saved;
  return getSystemTheme();
}

function getServerTheme() {
  return "dark";
}

function subscribeTheme(onStoreChange) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: light)")
      : null;

  const onSystemChange = () => {
    if (!readSavedChoice()) {
      applyDomTheme(getSystemTheme());
      onStoreChange();
    }
  };

  window.addEventListener(THEME_EVENT, handler);
  window.addEventListener("storage", handler);
  if (mql) {
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onSystemChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onSystemChange);
    }
  }

  return () => {
    window.removeEventListener(THEME_EVENT, handler);
    window.removeEventListener("storage", handler);
    if (mql) {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onSystemChange);
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(onSystemChange);
      }
    }
  };
}

function applyDomTheme(next) {
  if (typeof document === "undefined") return;
  const resolved = next === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribeTheme, readClientTheme, getServerTheme);

  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    const resolved = nextTheme === "light" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    applyDomTheme(resolved);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const current = readClientTheme();
    setTheme(current === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
