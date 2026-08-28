import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Users, Search, X, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import type { AdminRole, AdminPermission, PermissionGroup } from "@/lib/permissions";

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {["Role", "Admins", "Permissions", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border/30">
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-5 py-3">
                    <Skeleton className={cn("h-4", j === 2 ? "w-32" : j === 0 ? "w-28" : "w-12")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RolesTab() {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState<AdminRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get("/admin/roles").then((r) => r.data?.data || []),
  });

  const { data: permsData, isLoading: permsLoading } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => api.get("/admin/roles/permissions").then((r) => r.data?.data?.permissions || []),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; permissionIds: string[] }) =>
      api.post("/admin/roles", data),
    onSuccess: () => {
      toast.success("Role created");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      closeEditor();
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create role"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; description: string; permissionIds: string[] }) =>
      api.put(`/admin/roles/${data.id}`, data),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      closeEditor();
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setShowDelete(null);
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to delete role"),
  });

  function openEditor(role: AdminRole | null) {
    if (role) {
      setEditingRole(role);
      setEditName(role.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
      setEditDesc(role.description || "");
      setEditPerms(new Set(role.permissions.map((p) => p.permission.id)));
    } else {
      setEditingRole(null);
      setEditName("");
      setEditDesc("");
      setEditPerms(new Set());
    }
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingRole(null);
  }

  function togglePerm(key: string) {
    setEditPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function saveRole() {
    const name = editName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name) { toast.error("Role name is required"); return; }
    const payload = { name, description: editDesc.trim(), permissionIds: Array.from(editPerms) };
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const groupedPerms: PermissionGroup = {};
  if (permsData) {
    for (const p of permsData as AdminPermission[]) {
      if (!groupedPerms[p.category]) groupedPerms[p.category] = [];
      groupedPerms[p.category].push(p);
    }
  }

  const roles: AdminRole[] = rolesData || [];
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (rolesLoading) return <TableSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button onClick={() => openEditor(null)} className="gap-2 shadow-sm w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Create Role
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/40 border-b border-border/40">
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Admins</th>
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Permissions</th>
                <th className="px-5 py-3.5 text-right font-semibold text-text-secondary text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role, idx) => (
                <tr key={role.id} className={cn(
                  "border-b border-border/30 transition-colors hover:bg-surface-muted/50",
                  idx === filteredRoles.length - 1 && "border-b-0",
                )}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-text-primary/5 text-text-primary flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-medium text-text-primary">
                          {role.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        {role.isSystem && (
                          <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">System</Badge>
                        )}
                        {role.description && (
                          <p className="text-xs text-text-secondary mt-0.5">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="font-medium">{role._count?.users || 0}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 4).map((rp) => (
                        <Badge key={rp.permission.id} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {rp.permission.name}
                        </Badge>
                      ))}
                      {role.permissions.length > 4 && (
                        <span className="text-[10px] text-text-secondary font-medium px-1.5 py-0.5 bg-surface-muted rounded">
                          +{role.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!role.isSystem && (
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 hover:bg-surface-muted hover:text-text-primary" onClick={() => openEditor(role)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setShowDelete(role)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRoles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-text-secondary">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-text-tertiary" />
                    No roles found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showEditor} onOpenChange={closeEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto !bg-surface-base/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-text-primary/5 text-text-primary flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              {editingRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {editingRole ? "Update role name, description, and permissions" : "Define a new admin role with specific permissions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Role Name</Label>
                <Input id="role-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Finance Admin" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Input id="role-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="What this role can do..." />
              </div>
            </div>
            <div>
              <Label className="mb-3 block text-sm font-medium text-text-primary">Permissions</Label>
              {permsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-3">
                      <Skeleton className="h-4 w-20 mb-3" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                Object.entries(groupedPerms).map(([category, perms]) => (
                  <div key={category} className="mb-3 rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-muted/60 border-b border-border/40">
                      <h4 className="text-xs font-semibold text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          {category}
                          <span className="text-text-tertiary font-normal">({perms.length})</span>
                        </span>
                      </h4>
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-colors text-sm",
                              editPerms.has(perm.id)
                                ? "bg-text-primary/5 border border-text-primary/15"
                                : "hover:bg-surface-muted border border-transparent",
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-all duration-150",
                              editPerms.has(perm.id)
                                ? "bg-text-primary border-text-primary"
                                : "border-border bg-surface-base",
                            )}>
                              {editPerms.has(perm.id) && (
                                <Check className="h-3 w-3 text-white stroke-[3]" />
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={editPerms.has(perm.id)}
                              onChange={() => togglePerm(perm.id)}
                              className="sr-only"
                            />
                            <div>
                              <span className="text-text-primary text-xs">{perm.name}</span>
                              {perm.description && (
                                <p className="text-[10px] text-text-tertiary leading-tight">{perm.description}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} className="shadow-sm">Cancel</Button>
            <Button onClick={saveRole} disabled={createMutation.isPending || updateMutation.isPending} className="gap-2 shadow-sm">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <DialogTitle>Delete Role</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Are you sure you want to delete "{showDelete?.name?.replace(/_/g, " ")}"? This action cannot be undone.
                  {showDelete?._count?.users ? (
                    <p className="mt-2 flex items-center gap-1.5 text-red-600 font-medium bg-red-50 px-3 py-2 rounded-lg text-sm">
                      <Users className="h-4 w-4" />
                      {showDelete._count.users} admin(s) are assigned to this role. Reassign them first.
                    </p>
                  ) : null}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)} className="shadow-sm">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => showDelete && deleteMutation.mutate(showDelete.id)}
              disabled={deleteMutation.isPending || (showDelete?._count?.users ?? 0) > 0}
              className="gap-2 shadow-sm"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

