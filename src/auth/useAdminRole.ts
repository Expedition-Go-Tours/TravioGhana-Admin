import { useAuthContext } from "@/auth/auth-context";

/**
 * Thin wrapper over the AuthProvider that preserves the historical
 * `useQuery`-style return shape (`{ data, isLoading }`) so existing call
 * sites (PermissionRoute, AppLayout, SettingsPage) keep working.
 *
 * The `enabled` argument is retained for API compatibility; the provider owns
 * the single `["admin","me"]` query and its enabled state.
 */
export function useAdminRole(_enabled = true) {
  void _enabled;
  const { role, isLoading } = useAuthContext();
  return { data: role, isLoading };
}
