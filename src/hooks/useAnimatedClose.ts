import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Delay the unmount of a portal panel so its exit animation can play.
 *
 * Panels are conditionally rendered by their parent, so calling `onClose`
 * immediately removes them from the DOM and the closing animation never runs.
 * This flips `closing` for the duration of the animation, then calls the
 * parent's close handler. Every close path (overlay, X, Escape) must go
 * through `requestClose` or the panel will disappear without animating.
 *
 * `prefers-reduced-motion` skips the wait entirely.
 */
export function useAnimatedClose(onClose: () => void, durationMs = 220) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(
      () => onCloseRef.current(),
      reduceMotion ? 0 : durationMs,
    );
  }, [durationMs]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { closing, requestClose };
}
