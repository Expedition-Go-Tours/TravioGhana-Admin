import { useEffect, useCallback } from "react";
import { useAuthContext } from "@/auth/auth-context";

// Idle timeout for the admin console. After the configured period with no
// user activity, the session is ended and the user is redirected to login.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuthContext();

  const onIdle = useCallback(() => {
    if (isAuthenticated) {
      void logout();
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    reset();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isAuthenticated, onIdle]);
}
