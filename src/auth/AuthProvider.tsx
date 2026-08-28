import { useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { disconnectAdminSocket } from "@/lib/adminSocket";
import { resetLoginRedirectGuard } from "@/lib/axios";
import {
  AuthContext,
  clearStoredAuth,
  flattenPermissions,
  type AdminRoleData,
  type AdminUserData,
  type AuthContextValue,
} from "@/auth/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasStoredSession = !!localStorage.getItem("adminRoleId");

  const query = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const res = await api.get("/admin/me", { skipGlobalErrorHandler: true } as never);
      const userData = res.data?.data as AdminUserData | undefined;
      if (userData?.adminRoleId && userData?.adminRole) {
        const flat: AdminRoleData = {
          ...userData.adminRole,
          permissions: flattenPermissions(userData.adminRole),
        };
        // Non-authoritative UI cache only — the server remains the source of
        // truth for authorization.
        localStorage.setItem("adminRoleId", userData.adminRoleId);
        localStorage.setItem("adminRole", JSON.stringify(flat));
        localStorage.setItem("userName", userData.name || "");
        return { user: userData, role: flat };
      }
      clearStoredAuth();
      return { user: null, role: null };
    },
    enabled: hasStoredSession,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const data = query.data;
  const user = data?.user ?? null;
  const role = data?.role ?? null;
  const isAuthenticated = !!role;

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post("/auth/login", { email, password });
      // Force-fetch the profile so the session + cache are populated before
      // navigation. invalidateQueries is a no-op on a disabled query, so we
      // must use fetchQuery (which runs regardless of `enabled`).
      await queryClient.fetchQuery({ queryKey: ["admin", "me"] });
      resetLoginRedirectGuard();
      return true;
    },
    [queryClient],
  );

  const loginWithGoogle = useCallback(async () => {
    const base = import.meta.env.VITE_API_URL || "/api";
    window.location.href = `${base}/auth/google`;
    // Full page navigation — this promise never resolves meaningfully.
    return false;
  }, []);

  const loginWithGoogleOneTap = useCallback(
    async (credential: string) => {
      await api.post("/auth/google/onetap", { credential });
      // Force-fetch the profile (see login) so the session is established
      // before the One Tap handler navigates the user off the login page.
      await queryClient.fetchQuery({ queryKey: ["admin", "me"] });
      resetLoginRedirectGuard();
      return true;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout errors — we clear local state regardless.
    }
    clearStoredAuth();
    disconnectAdminSocket();
    queryClient.clear();
    window.location.assign("/admin/login");
  }, [queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      permissions: role?.permissions ?? [],
      isLoading: query.isLoading,
      isAuthenticated,
      login,
      loginWithGoogle,
      loginWithGoogleOneTap,
      logout,
      loginLoading: false,
      loginError: null,
      refresh,
    }),
    [
      user,
      role,
      query.isLoading,
      isAuthenticated,
      login,
      loginWithGoogle,
      loginWithGoogleOneTap,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
