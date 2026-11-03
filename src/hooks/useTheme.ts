import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  applyTheme,
  getStoredTheme,
  isLowPowerDevice,
  prefersReducedMotion,
  revealRadius,
  watchSystemTheme,
  watchThemeStorage,
  THEME_FALLBACK_MS,
  THEME_TRANSITION_MS,
  type Theme,
} from "@/lib/theme";

/** Where the reveal should start, in viewport pixels (usually the toggle). */
export interface ThemeOrigin {
  x: number;
  y: number;
}

/** Minimal shape we use: the DOM lib may lag behind browser support. */
type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
};
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
  documentElement: HTMLElement & {
    animate: (keyframes: Keyframe[], options?: KeyframeAnimationOptions) => Animation;
  };
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [isSwitching, setIsSwitching] = useState(false);
  const switchingRef = useRef(false);

  // Keep the DOM in sync for any state change, but never persist here: a
  // toggle writes the preference explicitly, while OS- and storage-driven
  // changes must not become a stored choice (or the theme would stop
  // following the OS after the first visit).
  useEffect(() => {
    applyTheme(theme, { persist: false });
  }, [theme]);

  // Both live sources apply without animation: a background OS change or
  // another tab's toggle is not a request for a reveal here.
  useEffect(() => watchSystemTheme(setTheme), []);
  useEffect(() => watchThemeStorage(setTheme), []);

  /**
   * Flip the theme with a circular reveal growing out of `origin`.
   *
   * The class flip is atomic — one style recalc — so it runs inside the
   * transition callback while the browser holds a snapshot of the old theme
   * on top. The animation is that snapshot being clipped away; the live page
   * underneath is already the new theme and interactive.
   */
  const toggleWithTransition = useCallback(
    (origin?: ThemeOrigin) => {
      if (switchingRef.current) return;
      const next: Theme = theme === "dark" ? "light" : "dark";

      const apply = () => {
        // flushSync so the theme-dependent icon renders in the same frame as
        // the class flip; otherwise the new snapshot keeps the old icon.
        flushSync(() => setTheme(next));
        applyTheme(next);
      };

      const canReveal =
        typeof (document as DocumentWithViewTransition).startViewTransition === "function" &&
        document.visibilityState === "visible" &&
        !prefersReducedMotion() &&
        !isLowPowerDevice();

      if (!canReveal) {
        // Fallback: a short color fade, or a hard swap under reduced motion.
        if (!prefersReducedMotion()) {
          const root = document.documentElement;
          root.classList.add("theme-switching");
          window.setTimeout(() => root.classList.remove("theme-switching"), THEME_FALLBACK_MS + 40);
        }
        apply();
        return;
      }

      switchingRef.current = true;
      setIsSwitching(true);

      const doc = document as DocumentWithViewTransition;
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 0;
      const radius = revealRadius(x, y, window.innerWidth, window.innerHeight);

      const transition = doc.startViewTransition!(() => {
        flushSync(() => setTheme(next));
        applyTheme(next);
      });

      const settle = () => {
        switchingRef.current = false;
        setIsSwitching(false);
      };

      // `ready` rejects when the transition is skipped (another one started,
      // or the tab was hidden); the theme is still applied either way.
      transition.ready
        .then(() => {
          if (typeof doc.documentElement.animate !== "function") return;
          doc.documentElement.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
            },
            {
              duration: THEME_TRANSITION_MS,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});

      transition.finished.then(settle, settle);
    },
    [theme],
  );

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, setTheme, toggle, toggleWithTransition, isSwitching };
}
