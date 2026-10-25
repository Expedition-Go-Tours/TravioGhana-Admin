import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";

const REDIRECT_DELAY_MS = 2000;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    let cancelled = false;

    const redirectToLogin = (message: string) => {
      if (cancelled) return;
      setStatus(message);
      setTimeout(() => {
        if (!cancelled) navigate("/admin/login", { replace: true });
      }, REDIRECT_DELAY_MS);
    };

    const complete = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("accessToken");
      const refreshToken = params.get("refreshToken");

      // Never leave bearer tokens in the address bar or browser history. The
      // OAuth redirect also sets httpOnly cookies, but some browsers drop them
      // when the API host differs from the callback host; set-cookies makes the
      // handoff explicit on the host the dashboard will actually call.
      if (accessToken || refreshToken) {
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }

      if (accessToken && refreshToken) {
        try {
          await api.post(
            "/auth/set-cookies",
            { accessToken, refreshToken },
            { skipGlobalErrorHandler: true } as never,
          );
        } catch {
          // Continue: the redirect response may already have set the cookies.
          // The /admin/me call below is the authoritative check.
        }
      }

      try {
        const res = await api.get("/admin/me", { skipGlobalErrorHandler: true } as never);
        if (cancelled) return;
        const userData = res.data?.data;

        if (!userData?.adminRoleId) {
          redirectToLogin("You do not have admin access. Redirecting...");
          return;
        }

        localStorage.setItem("adminRoleId", userData.adminRoleId);
        localStorage.setItem("adminRole", JSON.stringify(userData.adminRole));
        localStorage.setItem("userName", userData.name || "");

        const { getDefaultRoute } = await import("@/lib/permissions");
        if (!cancelled) window.location.href = getDefaultRoute();
      } catch {
        redirectToLogin("Access denied. Redirecting...");
      }
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-50/60 dark:from-green-950/20 dark:via-surface-base dark:to-green-950/10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
        <p className="text-sm text-text-secondary">{status}</p>
      </div>
    </div>
  );
}
