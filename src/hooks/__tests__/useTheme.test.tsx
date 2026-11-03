import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "@/hooks/useTheme";

const STORAGE_KEY = "travio-ghana-admin-theme";

type Deferred = { promise: Promise<void>; resolve: () => void; reject: () => void };
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installMatchMedia(reducedMotion = false) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? reducedMotion : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** jsdom has neither the View Transitions API nor Element.animate. */
function installViewTransition() {
  const ready = deferred();
  const finished = deferred();
  const animate = vi.fn();
  const startViewTransition = vi.fn((callback: () => void) => {
    callback();
    return { ready: ready.promise, finished: finished.promise };
  });

  Object.defineProperty(document, "startViewTransition", {
    value: startViewTransition,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document.documentElement, "animate", {
    value: animate,
    configurable: true,
    writable: true,
  });

  return { startViewTransition, animate, ready, finished };
}

beforeEach(() => {
  installMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Remove any property stubs added to document.
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  delete (document.documentElement as unknown as Record<string, unknown>).animate;
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("useTheme — reveal", () => {
  it("grows a clip-path circle from the origin when the API exists", async () => {
    const vt = installViewTransition();
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    act(() => {
      result.current.toggleWithTransition({ x: 1200, y: 40 });
    });

    expect(vt.startViewTransition).toHaveBeenCalledTimes(1);
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");

    await act(async () => {
      vt.ready.resolve();
      await vt.ready.promise;
    });

    expect(vt.animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = vt.animate.mock.calls[0];
    expect(keyframes.clipPath[0]).toBe("circle(0px at 1200px 40px)");
    expect(keyframes.clipPath[1]).toMatch(/^circle\([\d.]+px at 1200px 40px\)$/);
    expect(options.pseudoElement).toBe("::view-transition-new(root)");
    expect(options.duration).toBeGreaterThan(300);

    await act(async () => {
      vt.finished.resolve();
      await vt.finished.promise;
    });
    expect(result.current.isSwitching).toBe(false);
  });

  it("sweeps dark up from the bottom-left corner by default", async () => {
    const vt = installViewTransition();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleWithTransition();
    });

    await act(async () => {
      vt.ready.resolve();
      await vt.ready.promise;
    });

    const [keyframes] = vt.animate.mock.calls[0];
    const y = window.innerHeight;
    expect(keyframes.clipPath[0]).toBe(`circle(0px at 0px ${y}px)`);
    expect(keyframes.clipPath[1]).toBe(`circle(${Math.hypot(window.innerWidth, y)}px at 0px ${y}px)`);
  });

  it("mirrors the light reveal from the top-right corner", async () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    const vt = installViewTransition();
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggleWithTransition();
    });

    await act(async () => {
      vt.ready.resolve();
      await vt.ready.promise;
    });

    const [keyframes] = vt.animate.mock.calls[0];
    const x = window.innerWidth;
    expect(keyframes.clipPath[0]).toBe(`circle(0px at ${x}px 0px)`);
    expect(keyframes.clipPath[1]).toBe(`circle(${Math.hypot(x, window.innerHeight)}px at ${x}px 0px)`);
  });

  it("ignores a second click while a reveal is in flight", async () => {
    const vt = installViewTransition();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });
    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });

    // Only one transition, and the theme did not flip twice.
    expect(vt.startViewTransition).toHaveBeenCalledTimes(1);
    expect(result.current.theme).toBe("dark");

    await act(async () => {
      vt.finished.resolve();
      await vt.finished.promise;
    });

    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });
    expect(vt.startViewTransition).toHaveBeenCalledTimes(2);
    expect(result.current.theme).toBe("light");
  });
});

describe("useTheme — fallbacks", () => {
  it("falls back to a color fade when View Transitions are missing", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("theme-switching")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("switches instantly under reduced motion, with no transition class", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("theme-switching")).toBe(false);
  });

  it("does not run the reveal when the tab is hidden", () => {
    installViewTransition();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleWithTransition({ x: 10, y: 10 });
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("theme-switching")).toBe(true);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});
