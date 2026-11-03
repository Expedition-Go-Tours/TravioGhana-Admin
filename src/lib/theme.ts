export type Theme = "light" | "dark";

const STORAGE_KEY = "travio-ghana-admin-theme";

/** Duration of the theme reveal in ms. Short enough to feel instant, long
 *  enough for the circle to read as one deliberate sweep. */
export const THEME_TRANSITION_MS = 620;

/** Duration of the fallback color fade (browsers without View Transitions). */
export const THEME_FALLBACK_MS = 280;

/** Preference stored by an explicit toggle. `null` means "follow the OS". */
export function getExplicitTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const explicit = getExplicitTheme();
  if (explicit) return explicit;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Apply a theme to the document. The class flip is atomic — one style recalc —
 * so it is safe to run inside a View Transition callback. `persist: false` is
 * for OS- and storage-driven changes, which must not become a stored choice.
 */
export function applyTheme(theme: Theme, options: { persist?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const { persist = true } = options;
  const root = window.document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  if (persist) persistTheme(theme);
}

/** Record the theme as an explicit user choice. */
export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore storage failures */
  }
}

/** Boot-time apply: never persists, so "follow the OS" stays the default. */
export function initTheme() {
  applyTheme(getStoredTheme(), { persist: false });
}

// ── Transition capability ────────────────────────────────────────────────────

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Very cheap devices pay a real cost to snapshot a full dashboard for a View
 * Transition (the snapshot is a bitmap). `deviceMemory` is Chrome/Edge only, so
 * an unknown value means "assume capable": phone browsers routinely report 2-4
 * hardware cores and would otherwise lose the reveal everywhere.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === "number" && memory <= 2;
}

/** Radius of the smallest circle centred on (x, y) that covers the viewport. */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

// ── Live theme sources (both apply without animation) ────────────────────────

/**
 * Follow the OS theme while the user has not made an explicit choice. A
 * background system change must not start a reveal the user did not ask for.
 */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handle = (event: MediaQueryListEvent) => {
    if (getExplicitTheme()) return;
    onChange(event.matches ? "dark" : "light");
  };
  media.addEventListener("change", handle);
  return () => media.removeEventListener("change", handle);
}

/** Mirror a toggle made in another tab, so open tabs never disagree. */
export function watchThemeStorage(onChange: (theme: Theme) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    if (event.newValue === "light" || event.newValue === "dark") onChange(event.newValue);
  };
  window.addEventListener("storage", handle);
  return () => window.removeEventListener("storage", handle);
}
