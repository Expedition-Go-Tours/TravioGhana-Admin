import { useAuthContext } from "@/auth/auth-context";

/**
 * Preserves the historical `useAuth()` API but now delegates to the single
 * AuthProvider (source of truth for auth state). `loading` and `error` are
 * provided for callers that still display a login spinner/message.
 */
export function useAuth() {
  const ctx = useAuthContext();

  return {
    login: ctx.login,
    loginWithGoogle: ctx.loginWithGoogle,
    loginWithGoogleOneTap: ctx.loginWithGoogleOneTap,
    logout: ctx.logout,
    loading: ctx.loginLoading,
    error: ctx.loginError,
    isAuthenticated: ctx.isAuthenticated,
  };
}
