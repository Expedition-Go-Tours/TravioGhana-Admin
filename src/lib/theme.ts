export type Theme = "light" | "dark";

const STORAGE_KEY = "travio-ghana-admin-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = window.document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore storage failures */
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}