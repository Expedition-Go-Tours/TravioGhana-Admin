import { useEffect, useRef } from "react";
import api from "@/lib/axios";
import { useAuthContext } from "@/auth/auth-context";

// Access tokens expire in 1h (backend). Refresh proactively well before expiry
// and whenever the tab becomes visible again, so a suspended tab doesn't come
// back to a burst of 401s.
const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 min
const MIN_REFRESH_GAP_MS = 60 * 1000; // don't refresh more than once a minute

export function useTokenRefresh() {
  const { isAuthenticated } = useAuthContext();
  const lastRefreshAt = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refresh = async () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;
      try {
        await api.post("/auth/refresh");
        lastRefreshAt.current = Date.now();
      } catch {
        // Silent — the response interceptor handles auth failures/redirect.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated]);
}
