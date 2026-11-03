import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  defaultRevealOrigin,
  getExplicitTheme,
  getStoredTheme,
  isLowPowerDevice,
  persistTheme,
  prefersReducedMotion,
  revealRadius,
  watchSystemTheme,
  watchThemeStorage,
} from "@/lib/theme";

const STORAGE_KEY = "travio-ghana-admin-theme";

/** jsdom has no matchMedia; install a controllable one. */
function installMatchMedia(reducedMotion = false, systemDark = false) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const media = {
    matches: systemDark,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  };
  vi.stubGlobal(
    "matchMedia",
    (query: string) => (query.includes("reduce") ? { ...media, matches: reducedMotion } : media),
  );
  return {
    emit(dark: boolean) {
      media.matches = dark;
      listeners.forEach((cb) => cb({ matches: dark } as MediaQueryListEvent));
    },
    get size() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("revealRadius", () => {
  it("covers the farthest corner from the origin", () => {
    // Top-right toggle on a 100x100 viewport: farthest corner is bottom-left.
    expect(revealRadius(100, 0, 100, 100)).toBeCloseTo(Math.hypot(100, 100));
    expect(revealRadius(50, 50, 100, 100)).toBeCloseTo(Math.hypot(50, 50));
    expect(revealRadius(0, 0, 100, 100)).toBeCloseTo(Math.hypot(100, 100));
  });

  it("is always enough to cover the viewport", () => {
    const width = 1440;
    const height = 900;
    for (const [x, y] of [[0, 0], [1440, 0], [0, 900], [720, 450], [1200, 40]]) {
      const r = revealRadius(x, y, width, height);
      for (const [cx, cy] of [[0, 0], [width, 0], [0, height], [width, height]]) {
        expect(Math.hypot(cx - x, cy - y)).toBeLessThanOrEqual(r + 1e-9);
      }
    }
  });
});

describe("defaultRevealOrigin", () => {
  it("is the bottom-left corner of the viewport", () => {
    expect(defaultRevealOrigin()).toEqual({ x: 0, y: window.innerHeight });
  });

  it("is wide enough to sweep the whole viewport from there", () => {
    const { x, y } = defaultRevealOrigin();
    const r = revealRadius(x, y, window.innerWidth, window.innerHeight);
    // Farthest corner from bottom-left is top-right.
    expect(Math.hypot(window.innerWidth, window.innerHeight)).toBeLessThanOrEqual(r + 1e-9);
  });
});

describe("device capability", () => {
  it("treats a very small deviceMemory as low power", () => {
    vi.stubGlobal("navigator", { deviceMemory: 2 });
    expect(isLowPowerDevice()).toBe(true);
  });

  it("treats a normal device as capable, and unknown as capable", () => {
    vi.stubGlobal("navigator", { deviceMemory: 8 });
    expect(isLowPowerDevice()).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(isLowPowerDevice()).toBe(false);
  });

  it("reports the user's motion preference, not the absence of matchMedia", () => {
    installMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    installMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
    vi.unstubAllGlobals();
    // No matchMedia: fall back to animating rather than silently disabling.
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("applyTheme / persistence", () => {
  it("applies the class and color-scheme atomically", () => {
    applyTheme("dark", { persist: false });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("persists only when asked", () => {
    applyTheme("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    window.localStorage.clear();
    applyTheme("light", { persist: false });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reads an explicit choice, else the system preference", () => {
    installMatchMedia(false, true);
    expect(getStoredTheme()).toBe("dark");
    expect(getExplicitTheme()).toBeNull();
    persistTheme("light");
    expect(getExplicitTheme()).toBe("light");
    expect(getStoredTheme()).toBe("light");
  });
});

describe("live theme sources", () => {
  it("follows the OS only while the user has made no choice", () => {
    const media = installMatchMedia(false, false);
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);

    media.emit(true);
    expect(onChange).toHaveBeenCalledWith("dark");

    persistTheme("light"); // explicit choice now exists
    media.emit(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    stop();
    expect(media.size).toBe(0);
  });

  it("mirrors toggles made in another tab and ignores other keys", () => {
    const onChange = vi.fn();
    const stop = watchThemeStorage(onChange);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "something-else", newValue: "dark" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "nonsense" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dark");
    stop();
  });
});
