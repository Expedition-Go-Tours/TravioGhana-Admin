import { useState, useCallback, type FormEvent } from "react";
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
  Eye,
  EyeOff,
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
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRoleId, setNewRoleId] = useState("");
  const queryClient = useQueryClient();

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
    mutationFn: (data: { email: string; name?: string; password: string; adminRoleId: string }) =>
      api.post("/admin/admins", data),
    onSuccess: (response) => {
      const newAdmin = response.data?.data;
      if (newAdmin) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) => [
          { ...newAdmin, lastLoginAt: null, createdAt: new Date().toISOString() },
          ...(old ?? []),
        ]);
      }
      toast.success("Admin added");
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
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setShowPassword(false);
    setNewRoleId("");
  }, []);

  const handleAddAdmin = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const email = newEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error("Enter a valid email address");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (!newRoleId) {
        toast.error("Choose a role");
        return;
      }
      addMutation.mutate({
        email,
        name: newName.trim() || undefined,
        password: newPassword,
        adminRoleId: newRoleId,
      });
    },
    [addMutation, newEmail, newName, newPassword, newRoleId],
  );

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
          <form onSubmit={handleAddAdmin} className="space-y-5">
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <DialogTitle>Add an admin</DialogTitle>
                  <DialogDescription className="mt-1">
                    Create a console account with an email and password. If the email already belongs to a Travio user, that account is promoted and the password is replaced.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">
                  Name <span className="font-normal text-text-tertiary">(optional)</span>
                </Label>
                <Input
                  id="admin-name"
                  placeholder="e.g. Ama Mensah"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="name@company.com"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-text-tertiary">
                  At least 8 characters. If this email already has an account, the password above replaces the current one.
                </p>
              </div>

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
              <Button type="button" variant="outline" onClick={resetAddDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending} className="gap-2">
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add admin
              </Button>
            </DialogFooter>
          </form>
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
