import api from "@/lib/axios";

export interface AdminSupplierSearchResult {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
}

/** Search suppliers by name/email (server-side, capped at 20). */
export const searchSuppliers = (q: string) =>
  api
    .get("/admin/users/search", { params: { q, role: "supplier" } })
    .then((r) => (r.data?.data?.users || []) as AdminSupplierSearchResult[]);

export interface ExpeditionRoleResult {
  user: { id: string; roles: string[] };
}

/**
 * Grant/revoke the "expedition" role for a supplier. Suppliers with the role
 * publish to Expedition Go with a DIRECT booking flow; without it they publish
 * as EXTERNAL (redirecting to Travio Ghana).
 */
export const toggleSupplierExpeditionRole = (id: string, enabled: boolean) =>
  api
    .patch(`/admin/suppliers/${id}/expedition-role`, { enabled })
    .then((r) => (r.data?.data as ExpeditionRoleResult) ?? null);
