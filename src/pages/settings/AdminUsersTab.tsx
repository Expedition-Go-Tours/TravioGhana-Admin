import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  ShieldOff,
  Loader2,
  ShieldCheck,
  Search,
  X,
  AlertTriangle,
  Users as UsersIcon,
  Mail,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AdminUser, AdminRole } from "@/lib/permissions";
import OptimizedImage from "@/components/shared/OptimizedImage";

type UserResult = { id: string; name: string; email: string; photoURL?: string };

function formatRoleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 w-full rounded-md sm:w-64" />
          <Skeleton className="h-10 w-full rounded-md sm:w-40" />
        </div>
        <Skeleton className="h-10 w-full rounded-full sm:w-32" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-base">
        <div className="border-b border-border px-5 py-3">
          <Skeleton className="h-3 w-28" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-36 rounded-md sm:block" />
            <Skeleton className="hidden h-5 w-14 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        active ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-tertiary",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-text-tertiary")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AdminAvatar({ admin, size = 36 }: { admin: Pick<AdminUser, "name" | "photoURL">; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      style={{ height: size, width: size }}
    >
      {admin.photoURL ? (
        <OptimizedImage
          src={admin.photoURL}
          alt=""
          width={size}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        admin.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function AdminUsersTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [showRevoke, setShowRevoke] = useState<AdminUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [newRoleId, setNewRoleId] = useState("");
  const queryClient = useQueryClient();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin", "admin-users"],
    queryFn: () => api.get("/admin/admins").then((r) => r.data?.data || []),
  });

  const { data: roles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get("/admin/roles").then((r) => r.data?.data || []),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, adminRoleId }: { userId: string; adminRoleId: string }) =>
      api.patch(`/admin/admins/${userId}/role`, { adminRoleId }),
    onSuccess: (response) => {
      const updated = response.data?.data;
      if (updated) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) =>
          old?.map((admin) => (admin.id === updated.id ? { ...admin, ...updated } : admin)) ?? [],
        );
      }
      toast.success("Admin role updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
    },
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not update the role",
      ),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/admins/${userId}/revoke`),
    onSuccess: (response) => {
      const revokedId = response.data?.data?.id;
      if (revokedId) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) =>
          old?.filter((admin) => admin.id !== revokedId) ?? [],
        );
      }
      toast.success("Admin access revoked");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      setShowRevoke(null);
    },
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not revoke access",
      ),
  });

  const addMutation = useMutation({
    mutationFn: (data: { userId: string; adminRoleId: string }) => api.post("/admin/admins", data),
    onSuccess: (response) => {
      const newAdmin = response.data?.data;
      if (newAdmin) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) => [
          { ...newAdmin, lastLoginAt: null, createdAt: new Date().toISOString() },
          ...(old ?? []),
        ]);
      }
      toast.success("Admin access granted");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      resetAddDialog();
    },
    onError: (err: Error) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not add the admin",
      ),
  });

  const resetAddDialog = useCallback(() => {
    setShowAdd(false);
    setSelectedUser(null);
    setUserSearch("");
    setSearchResults([]);
    setNewRoleId("");
    setSearchLoading(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const handleUserSearch = useCallback((query: string) => {
    setUserSearch(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await api.get(`/admin/users/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data?.data?.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const allAdmins: AdminUser[] = admins || [];
  const allRoles: AdminRole[] = roles || [];
  const query = searchTerm.trim().toLowerCase();

  const filtered = allAdmins.filter((admin) => {
    if (roleFilter !== "all" && admin.adminRole?.name !== roleFilter) return false;
    if (!query) return true;
    return (
      admin.name.toLowerCase().includes(query) || admin.email.toLowerCase().includes(query)
    );
  });

  const selectedRole = allRoles.find((role) => role.id === newRoleId);
  const hasFilters = Boolean(searchTerm) || roleFilter !== "all";

  if (isLoading) return <ListSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Search admins"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
              aria-label="Search admins"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {allRoles.map((role) => (
                <SelectItem key={role.id} value={role.name}>
                  {formatRoleName(role.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAdd(true)} className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" /> Add admin
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface-base md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Admin
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Role
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Last active
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((admin) => {
                const rowPending =
                  changeRoleMutation.isPending && changeRoleMutation.variables?.userId === admin.id;
                return (
                  <tr
                    key={admin.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <AdminAvatar admin={admin} />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-text-primary">{admin.name}</span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{admin.email}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Select
                          value={admin.adminRole?.id ?? ""}
                          onValueChange={(value) =>
                            changeRoleMutation.mutate({ userId: admin.id, adminRoleId: value })
                          }
                          disabled={changeRoleMutation.isPending}
                        >
                          <SelectTrigger
                            className="h-8 w-[152px] text-xs"
                            aria-label={`Role for ${admin.name}`}
                          >
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            {allRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {formatRoleName(role.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {rowPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill active={admin.active} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Clock className="h-3 w-3 text-text-tertiary" />
                        {admin.lastLoginAt ? timeAgo(admin.lastLoginAt) : "Never"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-status-rejected-text hover:bg-status-rejected/10 hover:text-status-rejected-text"
                        onClick={() => setShowRevoke(admin)}
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <UsersIcon className="mb-3 h-8 w-8 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">No admins found</p>
            <p className="mt-1 max-w-sm text-[13px] text-text-tertiary">
              {hasFilters ? "No admin matches these filters." : "Add an admin to give someone access to this console."}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchTerm("");
                  setRoleFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        <div className="border-t border-border px-5 py-3">
          <p className="text-[11px] text-text-tertiary">
            Showing {filtered.length} of {allAdmins.length} {allAdmins.length === 1 ? "admin" : "admins"}
          </p>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="space-y-2 md:hidden">
          <p className="px-1 text-[11px] text-text-tertiary">
            Showing {filtered.length} of {allAdmins.length} {allAdmins.length === 1 ? "admin" : "admins"}
          </p>
          {filtered.map((admin) => {
            const rowPending =
              changeRoleMutation.isPending && changeRoleMutation.variables?.userId === admin.id;
            return (
              <div
                key={admin.id}
                className="rounded-xl border border-border bg-surface-base px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <AdminAvatar admin={admin} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{admin.name}</p>
                    <p className="mt-0.5 truncate text-xs text-text-tertiary">{admin.email}</p>
                  </div>
                  <StatusPill active={admin.active} />
                </div>
                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Select
                      value={admin.adminRole?.id ?? ""}
                      onValueChange={(value) =>
                        changeRoleMutation.mutate({ userId: admin.id, adminRoleId: value })
                      }
                      disabled={changeRoleMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-[180px] text-xs" aria-label={`Role for ${admin.name}`}>
                        <SelectValue placeholder="Assign role" />
                      </SelectTrigger>
                      <SelectContent>
                        {allRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {formatRoleName(role.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rowPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRevoke(admin)}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-status-rejected-text transition-colors hover:bg-status-rejected/10"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Revoke
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <Clock className="h-3 w-3" />
                  Last active {admin.lastLoginAt ? timeAgo(admin.lastLoginAt) : "never"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base px-6 py-14 text-center md:hidden">
          <UsersIcon className="mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm font-medium text-text-primary">No admins found</p>
          <p className="mt-1 max-w-sm text-[13px] text-text-tertiary">
            {hasFilters ? "No admin matches these filters." : "Add an admin to give someone access to this console."}
          </p>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={(open) => !open && resetAddDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle>Grant admin access</DialogTitle>
                <DialogDescription className="mt-1">
                  Find an existing Travio account and choose what they can do.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="user-search">Travio account</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="user-search"
                  placeholder="Search by name or email"
                  value={userSearch}
                  onChange={(event) => handleUserSearch(event.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                />
                {userSearch && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
                    onClick={() => {
                      setUserSearch("");
                      setSearchResults([]);
                      setSelectedUser(null);
                    }}
                    aria-label="Clear user search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-text-tertiary">Type at least two characters.</p>
            </div>

            {searchLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-4 py-6 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching accounts
              </div>
            )}

            {!searchLoading && userSearch.length >= 2 && searchResults.length === 0 && !selectedUser && (
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-4 py-8 text-center">
                <UsersIcon className="mb-1 h-7 w-7 text-text-tertiary" />
                <p className="text-sm font-medium text-text-primary">No accounts found</p>
                <p className="text-xs text-text-tertiary">Try a different name or email address.</p>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && !selectedUser && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-muted"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchResults([]);
                    }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="truncate text-xs text-text-tertiary">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{selectedUser.name}</p>
                    <p className="truncate text-xs text-text-tertiary">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-base hover:text-text-primary"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSearch("");
                    setSearchResults([]);
                  }}
                  aria-label="Remove selected user"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-role">Role</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger id="admin-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {formatRoleName(role.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-relaxed text-text-tertiary">
                {selectedRole?.description || "The role decides which pages and actions this admin can use."}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={resetAddDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedUser || !newRoleId) {
                  toast.error("Select an account and a role");
                  return;
                }
                addMutation.mutate({ userId: selectedUser.id, adminRoleId: newRoleId });
              }}
              disabled={!selectedUser || !newRoleId || addMutation.isPending}
              className="gap-2"
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-rejected/10">
                <AlertTriangle className="h-5 w-5 text-status-rejected-text" />
              </div>
              <div className="min-w-0">
                <DialogTitle>Revoke admin access?</DialogTitle>
                <DialogDescription className="mt-1.5">
                  This takes effect immediately. The account keeps its Travio profile but loses access to this console.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {showRevoke && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
              <AdminAvatar admin={showRevoke} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{showRevoke.name}</p>
                <p className="truncate text-xs text-text-tertiary">{showRevoke.email}</p>
              </div>
              {showRevoke.adminRole && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {formatRoleName(showRevoke.adminRole.name)}
                </Badge>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRevoke && revokeMutation.mutate(showRevoke.id)}
              disabled={revokeMutation.isPending}
              className="gap-2"
            >
              {revokeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
