import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  Users,
  Search,
  X,
  Check,
  KeyRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import type { AdminRole, AdminPermission, PermissionGroup } from "@/lib/permissions";

function formatRoleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-md sm:w-72" />
        <Skeleton className="h-10 w-full rounded-full sm:w-28" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-base">
        <div className="border-b border-border px-5 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-64 max-w-full" />
              <Skeleton className="h-5 w-48 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
          </div>
        ))}
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
  const [permSearch, setPermSearch] = useState("");

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
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not create the role",
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; description: string; permissionIds: string[] }) =>
      api.put(`/admin/roles/${data.id}`, data),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      closeEditor();
    },
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not update the role",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setShowDelete(null);
    },
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not delete the role",
      ),
  });

  function openEditor(role: AdminRole | null) {
    setPermSearch("");
    if (role) {
      setEditingRole(role);
      setEditName(formatRoleName(role.name));
      setEditDesc(role.description || "");
      setEditPerms(new Set(role.permissions.map((permission) => permission.permission.id)));
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
    setPermSearch("");
  }

  function togglePerm(key: string) {
    setEditPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setCategory(categoryPerms: AdminPermission[], selected: boolean) {
    setEditPerms((prev) => {
      const next = new Set(prev);
      for (const permission of categoryPerms) {
        if (selected) next.add(permission.id);
        else next.delete(permission.id);
      }
      return next;
    });
  }

  function saveRole() {
    const name = editName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    const payload = { name, description: editDesc.trim(), permissionIds: Array.from(editPerms) };
    if (editingRole) updateMutation.mutate({ id: editingRole.id, ...payload });
    else createMutation.mutate(payload);
  }

  const filteredPermGroups = useMemo(() => {
    const groupedPerms: PermissionGroup = {};
    for (const permission of (permsData as AdminPermission[] | undefined) ?? []) {
      if (!groupedPerms[permission.category]) groupedPerms[permission.category] = [];
      groupedPerms[permission.category].push(permission);
    }

    const permissionQuery = permSearch.trim().toLowerCase();
    if (!permissionQuery) return Object.entries(groupedPerms);
    return Object.entries(groupedPerms)
      .map(([category, perms]) => [
        category,
        perms.filter(
          (permission) =>
            permission.name.toLowerCase().includes(permissionQuery) ||
            (permission.description || "").toLowerCase().includes(permissionQuery),
        ),
      ] as const)
      .filter(([, perms]) => perms.length > 0);
  }, [permsData, permSearch]);

  const allPermissionIds = (permsData as AdminPermission[] | undefined)?.map((permission) => permission.id) ?? [];
  const allSelected = allPermissionIds.length > 0 && allPermissionIds.every((id) => editPerms.has(id));

  const roles: AdminRole[] = rolesData || [];
  const filteredRoles = roles.filter((role) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      role.name.toLowerCase().includes(query) ||
      (role.description || "").toLowerCase().includes(query)
    );
  });

  if (rolesLoading) return <ListSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search roles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search roles"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button onClick={() => openEditor(null)} className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" /> New role
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-base">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-xs font-medium text-text-secondary">
            {filteredRoles.length} {filteredRoles.length === 1 ? "role" : "roles"}
          </p>
          <p className="hidden text-[11px] text-text-tertiary sm:block">
            System roles are managed by Travio
          </p>
        </div>

        <ul className="divide-y divide-border">
          {filteredRoles.map((role) => (
            <li key={role.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {formatRoleName(role.name)}
                    </span>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-[10px] font-medium">
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
                    {role.description || "No description yet."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {role.permissions.slice(0, 3).map((entry) => (
                      <span
                        key={entry.permission.id}
                        className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                      >
                        {entry.permission.name}
                      </span>
                    ))}
                    {role.permissions.length > 3 && (
                      <span className="text-[10px] font-medium text-text-tertiary">
                        +{role.permissions.length - 3} more
                      </span>
                    )}
                    <span className="mx-1 hidden h-3 w-px bg-border sm:block" />
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                      <Users className="h-3 w-3" />
                      {role._count?.users || 0} {(role._count?.users || 0) === 1 ? "admin" : "admins"}
                    </span>
                    <span className="mx-1 hidden h-3 w-px bg-border sm:block" />
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                      <KeyRound className="h-3 w-3" />
                      {role.permissions.length} permissions
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-1 self-end sm:self-auto">
                {role.isSystem ? (
                  <span className="text-[11px] font-medium text-text-tertiary">Managed by Travio</span>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => openEditor(role)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowDelete(role)}
                      className="h-8 w-8 text-text-tertiary hover:bg-status-rejected/10 hover:text-status-rejected-text"
                      aria-label={`Delete ${formatRoleName(role.name)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {filteredRoles.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <ShieldCheck className="mb-3 h-8 w-8 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">No roles found</p>
            <p className="mt-1 max-w-sm text-[13px] text-text-tertiary">
              {search ? `Nothing matches “${search}”. Try a different search.` : "Create a role to group admin permissions."}
            </p>
            {search && (
              <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-4">
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={showEditor} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="flex max-h-[85dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 py-5 text-left sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle>{editingRole ? "Edit role" : "Create role"}</DialogTitle>
                <DialogDescription className="mt-1">
                  {editingRole
                    ? "Update the role name, description, or permissions."
                    : "Name the role and choose the permissions it grants."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Role name</Label>
                <Input
                  id="role-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="e.g. Finance admin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Input
                  id="role-desc"
                  value={editDesc}
                  onChange={(event) => setEditDesc(event.target.value)}
                  placeholder="What this role can do"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Permissions</p>
                  <p className="mt-0.5 text-[13px] text-text-tertiary">
                    {editPerms.size} of {allPermissionIds.length} selected
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditPerms(new Set(allSelected ? [] : allPermissionIds))
                    }
                    disabled={permsLoading || allPermissionIds.length === 0}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  placeholder="Filter permissions"
                  value={permSearch}
                  onChange={(event) => setPermSearch(event.target.value)}
                  className="pl-9"
                  aria-label="Filter permissions"
                />
              </div>

              {permsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-lg border border-border p-3">
                      <Skeleton className="mb-3 h-4 w-24" />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((__, item) => (
                          <div key={item} className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPermGroups.length === 0 ? (
                <div className="rounded-lg border border-border px-4 py-10 text-center">
                  <p className="text-sm font-medium text-text-primary">No permissions match</p>
                  <p className="mt-1 text-[13px] text-text-tertiary">Try a shorter search.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPermGroups.map(([category, perms]) => {
                    const allInCategory = perms.every((permission) => editPerms.has(permission.id));
                    return (
                      <div key={category} className="overflow-hidden rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted px-3 py-2">
                          <p className="text-xs font-semibold text-text-primary">
                            {category}
                            <span className="ml-1.5 font-normal text-text-tertiary">({perms.length})</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setCategory(perms, !allInCategory)}
                            className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                          >
                            {allInCategory ? "Clear" : "Select all"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                          {perms.map((permission) => {
                            const checked = editPerms.has(permission.id);
                            return (
                              <label
                                key={permission.id}
                                className={cn(
                                  "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                                  checked
                                    ? "border-primary/25 bg-primary/5"
                                    : "border-transparent hover:bg-surface-muted",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePerm(permission.id)}
                                  className="peer sr-only"
                                />
                                <span
                                  className={cn(
                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                    "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-1",
                                    checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-surface-base",
                                  )}
                                >
                                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium text-text-primary">
                                    {permission.name}
                                  </span>
                                  {permission.description && (
                                    <span className="mt-0.5 block text-[11px] leading-snug text-text-tertiary">
                                      {permission.description}
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              onClick={saveRole}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingRole ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-rejected/10">
                <Trash2 className="h-5 w-5 text-status-rejected-text" />
              </div>
              <div className="min-w-0">
                <DialogTitle>Delete this role?</DialogTitle>
                <DialogDescription className="mt-1.5">
                  “{showDelete ? formatRoleName(showDelete.name) : ""}” will be removed permanently. This cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {(showDelete?._count?.users ?? 0) > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-status-rejected/25 bg-status-rejected/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-status-rejected-text">
              <Users className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {showDelete?._count?.users} {(showDelete?._count?.users ?? 0) === 1 ? "admin is" : "admins are"} assigned to this role. Reassign them before deleting.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDelete && deleteMutation.mutate(showDelete.id)}
              disabled={deleteMutation.isPending || (showDelete?._count?.users ?? 0) > 0}
              className="gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
