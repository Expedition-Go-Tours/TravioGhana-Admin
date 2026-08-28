import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldOff, Loader2, ShieldCheck, Search, X, AlertTriangle, Users as UsersIcon, Mail, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/axios";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AdminUser, AdminRole } from "@/lib/permissions";
import OptimizedImage from "@/components/shared/OptimizedImage";

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {["Admin", "Role", "Status", "Last Active", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3"><Skeleton className="h-7 w-32" /></td>
                <td className="px-5 py-3"><Skeleton className="h-5 w-14" /></td>
                <td className="px-5 py-3"><Skeleton className="h-3.5 w-16" /></td>
                <td className="px-5 py-3"><Skeleton className="h-7 w-16 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminUsersTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [showRevoke, setShowRevoke] = useState<AdminUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string; photoURL: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [newRoleId, setNewRoleId] = useState("");
  const [addDone, setAddDone] = useState(false);
  const [revokeDone, setRevokeDone] = useState(false);
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
          old?.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)) ?? [],
        );
      }
      toast.success("Admin role updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to update role"),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/admins/${userId}/revoke`),
    onSuccess: (response) => {
      const revokedId = response.data?.data?.id;
      if (revokedId) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) =>
          old?.filter((a) => a.id !== revokedId) ?? [],
        );
      }
      toast.success("Admin access revoked");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      setRevokeDone(true);
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to revoke access"),
  });

  const addMutation = useMutation({
    mutationFn: (data: { userId: string; adminRoleId: string }) =>
      api.post("/admin/admins", data),
    onSuccess: (response) => {
      const newAdmin = response.data?.data;
      if (newAdmin) {
        queryClient.setQueryData<AdminUser[]>(["admin", "admin-users"], (old) =>
          [{ ...newAdmin, lastLoginAt: null, createdAt: new Date().toISOString() }, ...(old ?? [])],
        );
      }
      toast.success("Admin access granted");
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      setAddDone(true);
    },
    onError: (err: Error) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to add admin"),
  });

  const resetAddModal = useCallback(() => {
    setShowAdd(false);
    setSelectedUser(null);
    setUserSearch("");
    setSearchResults([]);
    setNewRoleId("");
    setAddDone(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    if (!addDone) return;
    const timer = setTimeout(() => { resetAddModal(); setAddDone(false); }, 1500);
    return () => clearTimeout(timer);
  }, [addDone, resetAddModal]);

  useEffect(() => {
    if (!revokeDone) return;
    const timer = setTimeout(() => { setShowRevoke(null); setRevokeDone(false); }, 1500);
    return () => clearTimeout(timer);
  }, [revokeDone]);

  const handleUserSearch = useCallback((q: string) => {
    setUserSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.data?.data?.users || []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, []);

  const allAdmins: AdminUser[] = admins || [];
  const allRoles: AdminRole[] = roles || [];

  const filtered = allAdmins.filter((a) => {
    if (roleFilter !== "all" && a.adminRole?.name !== roleFilter) return false;
    if (searchTerm && !a.name.toLowerCase().includes(searchTerm.toLowerCase()) && !a.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
            <Input
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {allRoles.map((r) => (
                <SelectItem key={r.id} value={r.name}>
                  {r.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 shadow-sm w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/40 border-b border-border/40">
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Admin</th>
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold text-text-secondary text-xs uppercase tracking-wider">Last Active</th>
                <th className="px-5 py-3.5 text-right font-semibold text-text-secondary text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((admin, idx) => (
                <tr key={admin.id} className={cn(
                  "border-b border-border/30 transition-colors hover:bg-surface-muted/50",
                  idx === filtered.length - 1 && "border-b-0",
                )}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-text-primary/5 text-xs font-bold text-text-primary shrink-0">
                        {admin.photoURL ? (
                          <OptimizedImage src={admin.photoURL} alt="" width={36} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          admin.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-text-primary block truncate">{admin.name}</span>
                        <div className="flex items-center gap-1 text-xs text-text-secondary">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{admin.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {admin.adminRole ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={admin.adminRole.id}
                          onValueChange={(val) => changeRoleMutation.mutate({ userId: admin.id, adminRoleId: val })}
                        >
                          <SelectTrigger className="h-7 text-xs w-40 border-border/60 shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allRoles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {changeRoleMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-text-secondary" />}
                      </div>
                    ) : (
                      <span className="text-text-tertiary italic text-xs">No role</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant={admin.active ? "default" : "secondary"}
                      className={cn(
                        "text-xs font-medium",
                        admin.active && "bg-status-active/10 text-status-active hover:bg-status-active/10",
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", admin.active ? "bg-green-500" : "bg-text-tertiary")} />
                      {admin.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-text-tertiary" />
                      {admin.lastLoginAt ? timeAgo(admin.lastLoginAt) : "Never"}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 text-xs"
                      onClick={() => setShowRevoke(admin)}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-text-secondary">
                    <UsersIcon className="h-8 w-8 mx-auto mb-2 text-text-tertiary" />
                    No admin users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) resetAddModal(); }}>
        <DialogContent className="max-w-lg !bg-surface-base/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              Add Admin
            </DialogTitle>
            <DialogDescription>Search for a user and grant them admin access</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="user-search">Search User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input
                  id="user-search"
                  placeholder="Type name or email..."
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                />
                {userSearch && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                    onClick={() => { setUserSearch(""); setSearchResults([]); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {searchLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary bg-surface-muted rounded-lg border border-border/40">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching users...
              </div>
            )}

            {!searchLoading && userSearch.length >= 2 && searchResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center bg-surface-muted rounded-lg border border-border/40">
                <UsersIcon className="h-8 w-8 text-text-tertiary" />
                <p className="text-sm text-text-secondary">No users found for "{userSearch}"</p>
                <p className="text-xs text-text-tertiary">Try a different name or email</p>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && !selectedUser && (
              <>
                <p className="text-xs font-medium text-text-tertiary">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-surface-base shadow-sm -mt-2">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted border-b border-border/30 last:border-b-0 transition-colors"
                      onClick={() => setSelectedUser({ id: u.id, name: u.name, email: u.email })}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text-primary/5 text-xs font-bold text-text-primary">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{u.name}</p>
                        <p className="text-xs text-text-secondary truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedUser && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text-primary/5 text-xs font-bold text-text-primary">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{selectedUser.name}</p>
                    <p className="text-xs text-text-secondary truncate">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 ml-2 flex items-center justify-center w-8 h-8 sm:w-6 sm:h-6 rounded-md bg-surface-muted text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                  onClick={() => { setSelectedUser(null); setSearchResults([]); setUserSearch(""); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-role">Admin Role</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger id="admin-role" className="border-border/60">
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={resetAddModal} className="shadow-sm">Cancel</Button>
            <Button
              onClick={() => {
                if (selectedUser && newRoleId) {
                  addMutation.mutate({ userId: selectedUser.id, adminRoleId: newRoleId });
                } else {
                  toast.error("Select a user and a role");
                }
              }}
              disabled={!selectedUser || !newRoleId || addMutation.isPending || addDone}
              className="gap-2 shadow-sm"
            >
              {addDone ? (
                <>Added <ShieldCheck className="h-4 w-4" /></>
              ) : addMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
              ) : (
                "Grant Admin Access"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 ring-1 ring-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <DialogTitle>Revoke Admin Access</DialogTitle>
                <DialogDescription className="mt-1.5">
                  This action is permanent. The user will lose access to the admin dashboard immediately.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {showRevoke && (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-muted/50 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text-primary/5 text-sm font-bold text-text-primary">
                {showRevoke.photoURL ? (
                  <OptimizedImage src={showRevoke.photoURL} alt="" width={36} className="h-full w-full rounded-full object-cover" />
                ) : (
                  showRevoke.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{showRevoke.name}</p>
                <p className="text-xs text-text-secondary truncate">{showRevoke.email}</p>
              </div>
              {showRevoke.adminRole && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {showRevoke.adminRole.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Badge>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevoke(null)} className="shadow-sm">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => showRevoke && revokeMutation.mutate(showRevoke.id)}
              disabled={revokeMutation.isPending || revokeDone}
              className="gap-2 shadow-sm"
            >
              {revokeDone ? (
                <>Removed <ShieldCheck className="ml-1.5 h-4 w-4" /></>
              ) : revokeMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Revoking...</>
              ) : (
                "Revoke Access"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

