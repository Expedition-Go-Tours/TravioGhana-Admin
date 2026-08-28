export interface AdminPermission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  isSystem: boolean;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  _count?: { users: number };
  permissions: { permission: AdminPermission }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  adminRoleId: string | null;
  adminRole: { id: string; name: string; description: string | null } | null;
}

export interface AdminSettings {
  [key: string]: unknown;
}

export interface PermissionGroup {
  [category: string]: AdminPermission[];
}

export interface SystemConfig {
  [key: string]: unknown;
}

const ROUTE_PRIORITY = [
  { permission: 'dashboard.*', route: '/admin/overview' },
  { permission: 'analytics.view', route: '/admin/overview' },
  { permission: 'chat.customers', route: '/admin/chat/customers' },
  { permission: 'chat.suppliers', route: '/admin/chat/suppliers' },
  { permission: 'bookings.view', route: '/admin/bookings' },
  { permission: 'reviews.view', route: '/admin/reviews' },
  { permission: 'suppliers.view', route: '/admin/suppliers' },
  { permission: 'payouts.view', route: '/admin/payouts' },
  { permission: 'tours.view', route: '/admin/tours' },
  { permission: 'users.view', route: '/admin/user-growth' },
  { permission: 'payout-methods.view', route: '/admin/payouts?tab=methods' },
  { permission: 'settings.access', route: '/admin/settings' },
  { permission: 'blog.manage', route: '/admin/blog' },
];

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

function hasStoredPermission(permissionKey: string): boolean {
  try {
    const raw = localStorage.getItem('adminRole');
    if (!raw) return false;
    const role = JSON.parse(raw);
    if (role.name === 'super_admin') return true;
    const permissions = flattenPermissions(role);
    if (permissionKey.endsWith('*')) {
      const prefix = permissionKey.slice(0, -1);
      return permissions.some((p: string) => p.startsWith(prefix));
    }
    return permissions.includes(permissionKey);
  } catch {
    return false;
  }
}

export function getDefaultRoute(): string {
  for (const { permission, route } of ROUTE_PRIORITY) {
    if (hasStoredPermission(permission)) return route;
  }
  return '/admin/overview';
}
