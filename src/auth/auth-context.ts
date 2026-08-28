import { createContext, useContext } from "react";

export interface AdminRoleData {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  roles?: string[];
  adminRoleId?: string | null;
  adminRole?: AdminRoleData | null;
}

export function flattenPermissions(raw: { permissions?: unknown[] }): string[] {
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

export function clearStoredAuth() {
  localStorage.removeItem("adminRoleId");
  localStorage.removeItem("adminRole");
  localStorage.removeItem("userName");
}

export interface AuthContextValue {
  user: AdminUserData | null;
  role: AdminRoleData | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithGoogleOneTap: (credential: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loginLoading: boolean;
  loginError: string | null;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
