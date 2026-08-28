import { useCallback, useMemo } from "react";
import { useAuthContext } from "@/auth/auth-context";

interface StoredAdminRole {
  id: string;
  name: string;
  permissions: string[];
}

function flattenPermissions(raw: { permissions?: unknown[] }): string[] {
  if (!raw?.permissions) return [];
  return raw.permissions.map((p: unknown) => {
    if (typeof p === "string") return p;
    if (p && typeof p === "object" && "permission" in (p as Record<string, unknown>)) {
      const perm = (p as Record<string, unknown>).permission as Record<string, unknown> | undefined;
      if (perm && typeof perm.key === "string") return perm.key;
    }
    if (p && typeof p === "object" && "key" in (p as Record<string, unknown>)) {
      const key = (p as Record<string, unknown>).key;
      if (typeof key === "string") return key;
    }
    return "";
  }).filter(Boolean);
}

function getStoredAdminRole(): StoredAdminRole | null {
  try {
    const raw = localStorage.getItem("adminRole");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || "",
      name: parsed.name || "",
      permissions: flattenPermissions(parsed),
    };
  } catch {
    return null;
  }
}

function roleAllows(role: StoredAdminRole | null, permissionKey: string): boolean {
  if (!role) return false;
  if (role.name === "super_admin") return true;
  if (permissionKey.endsWith("*")) {
    const prefix = permissionKey.slice(0, -1);
    return role.permissions.some((p) => p.startsWith(prefix));
  }
  return role.permissions.includes(permissionKey);
}

/**
 * Reactive permission hook — derives from the AuthProvider (single source of
 * truth). Returns the historical `{ can, isSuperAdmin, adminRole, ... }`
 * shape so existing call sites keep working.
 */
export function usePermission() {
  const { role, isLoading } = useAuthContext();

  const adminRole = useMemo(
    () => (role ? { id: role.id, name: role.name, permissions: role.permissions } : null),
    [role],
  );

  const can = useCallback(
    (permissionKey: string): boolean => {
      return roleAllows(adminRole, permissionKey);
    },
    [adminRole],
  );

  const isSuperAdmin = adminRole?.name === "super_admin";

  const value = useMemo(
    () => ({ can, isSuperAdmin, adminRole, loading: isLoading, setAdminRole: () => {} }),
    [can, isSuperAdmin, adminRole, isLoading],
  );

  return value;
}

/**
 * Non-hook, localStorage-backed helpers retained for call sites outside React
 * (e.g. standalone menu gating). The AuthProvider keeps this cache in sync on
 * every `admin/me` fetch; the server remains the authority for real access.
 */
export function hasPermission(permissionKey: string): boolean {
  return roleAllows(getStoredAdminRole(), permissionKey);
}

export function isSuperAdmin(): boolean {
  const role = getStoredAdminRole();
  return role?.name === "super_admin";
}
