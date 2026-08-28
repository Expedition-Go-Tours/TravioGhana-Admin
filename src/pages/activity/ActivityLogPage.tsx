import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Users,
  CalendarDays,
  Clock,
  RefreshCw,
  Search,
  Download,
  History,
  ShieldCheck,
  ShieldOff,
  UserCog,
  ShieldPlus,
  ShieldX,
  ShieldAlert,
  LogIn,
  UserPlus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Settings,
  AlertCircle,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";

interface ActivityEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string;
  ipAddress: string | null;
  userAgent: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  details?: string | null;
}

interface ActivityStats {
  totalActivities: number;
  uniqueUsers: number;
  thisWeek: number;
  today: number;
  thisMonth: number;
  actionBreakdown: { action: string; count: number }[];
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  "auth.login": { label: "Logged In", icon: "log-in" },
  "auth.login_failed": { label: "Login Failed", icon: "alert-circle" },
  "auth.register": { label: "Account Created", icon: "user-plus" },
  "settings.updated": { label: "Settings Updated", icon: "settings" },
  "admin.granted": { label: "Admin Granted", icon: "shield-check" },
  "admin.revoked": { label: "Admin Revoked", icon: "shield-off" },
  "admin.role_changed": { label: "Role Changed", icon: "user-cog" },
  "admin_role.created": { label: "Role Created", icon: "shield-plus" },
  "admin_role.updated": { label: "Role Updated", icon: "shield" },
  "admin_role.deleted": { label: "Role Deleted", icon: "shield-x" },
  "security.": { label: "Security Event", icon: "shield-alert" },
  "booking.": { label: "Booking", icon: "shopping-cart" },
  "payment.": { label: "Payment", icon: "credit-card" },
  "user.deleted_by_admin": { label: "User Deleted", icon: "trash-2" },
  "tour.deleted": { label: "Tour Deleted", icon: "trash-2" },
  "tour.photo.deleted": { label: "Photo Deleted", icon: "trash-2" },
  "review.deleted": { label: "Review Deleted", icon: "trash-2" },
  "payout_method.deleted": { label: "Payout Method Deleted", icon: "trash-2" },
  "special-offer.deleted": { label: "Offer Deleted", icon: "trash-2" },
  "api.error": { label: "API Error", icon: "shield-alert" },
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "log-in": LogIn,
  "alert-circle": AlertCircle,
  "user-plus": UserPlus,
  settings: Settings,
  "shield-check": ShieldCheck,
  "shield-off": ShieldOff,
  "user-cog": UserCog,
  "shield-plus": ShieldPlus,
  shield: Shield,
  "shield-x": ShieldX,
  "shield-alert": ShieldAlert,
  "shopping-cart": ShoppingCart,
  "credit-card": CreditCard,
  "trash-2": Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "auth.login_failed": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "auth.register": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "settings.updated": "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  "admin.granted": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  "admin.revoked": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "admin.role_changed": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "admin_role.created": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  "admin_role.updated": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "admin_role.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "security.": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "booking.": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  "payment.": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  "user.deleted_by_admin": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "tour.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "tour.photo.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "review.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "payout_method.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "special-offer.deleted": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "api.error": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STAT_CARD_COLORS: Record<string, { bg: string }> = {
  totalActivities: {
    bg: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
  },
  uniqueUsers: {
    bg: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
  },
  thisWeek: {
    bg: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900",
  },
  today: {
    bg: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
  },
};

function getActionMeta(action: string) {
  for (const [prefix, meta] of Object.entries(ACTION_LABELS)) {
    if (action.startsWith(prefix)) {
      return {
        label: meta.label,
        icon: ACTION_ICONS[meta.icon] ?? History,
        color: ACTION_COLORS[prefix] ?? "bg-surface-muted text-text-secondary",
      };
    }
  }
  return {
    label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: History,
    color: "bg-surface-muted text-text-secondary",
  };
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  return (
    <Card className={`shadow-sm border-0 ${color}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getEndpoint(entry: ActivityEntry) {
  const ep = entry.metadata?.endpoint as { method?: string; url?: string } | undefined;
  if (ep?.method && ep?.url) return `${ep.method} ${ep.url}`;
  if (entry.resourceId) return `${entry.resource}/${entry.resourceId}`;
  return null;
}

export default function ActivityLogPage() {
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    checked: number;
    brokenAt?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedEmail(searchEmail.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchEmail]);

  const statsQuery = useQuery({
    queryKey: ["admin", "audit-log", "stats"],
    queryFn: () => api.get("/admin/audit-log/stats").then((r) => r.data?.data as ActivityStats),
    retry: false,
  });

  const actionsQuery = useQuery({
    queryKey: ["admin", "audit-log", "actions"],
    queryFn: () => api.get("/admin/audit-log/actions").then((r) => (r.data?.data || []) as string[]),
    retry: false,
  });

  const logsQuery = useQuery({
    queryKey: ["admin", "audit-log", { page, limit: 50, email: debouncedEmail, action: actionFilter, fromDate, toDate }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedEmail) params.set("email", debouncedEmail);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (fromDate) params.set("startDate", new Date(fromDate).toISOString());
      if (toDate) params.set("endDate", new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000).toISOString());
      return api.get(`/admin/audit-log?${params.toString()}`).then((r) => r.data?.data || { entries: [], total: 0, page: 1, pages: 1 });
    },
    retry: false,
  });

  const stats = statsQuery.data ?? null;
  const actions = actionsQuery.data || [];
  const logs = (logsQuery.data?.entries || []) as ActivityEntry[];
  const totalPages = logsQuery.data?.pages || 1;
  const loading = logsQuery.isLoading;

  const handleRefresh = () => {
    statsQuery.refetch();
    actionsQuery.refetch();
    logsQuery.refetch();
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data } = await api.get("/admin/audit-log/verify");
      const report = data?.data;
      setVerifyResult({
        valid: !!report?.verified,
        checked: report?.total ?? 0,
        brokenAt: report?.firstBreakAt ? new Date(report.firstBreakAt).toLocaleString("en-GB") : undefined,
        error: report?.breaks?.[0]?.reason,
      });
    } catch {
      setVerifyResult({ valid: false, checked: 0, error: "Verify request failed" });
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedEmail) params.set("email", debouncedEmail);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (fromDate) params.set("startDate", new Date(fromDate).toISOString());
      if (toDate) params.set("endDate", new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000).toISOString());
      const res = await api.get(`/admin/audit-log/export?${params.toString()}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground mt-1">Audit trail — who did what and when (admins & system)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            {verifying ? "Verifying..." : "Verify Integrity"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {verifyResult && (
        <div
          className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${
            verifyResult.valid
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
          }`}
        >
          {verifyResult.valid ? (
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>
            {verifyResult.valid
              ? `Audit chain intact — ${verifyResult.checked.toLocaleString()} entries verified`
              : `Integrity check failed after ${verifyResult.checked.toLocaleString()} entries${
                  verifyResult.brokenAt ? ` (at ${verifyResult.brokenAt})` : ""
                }${verifyResult.error ? `: ${verifyResult.error}` : ""}`}
          </span>
        </div>
      )}

      {/* Stats Cards */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Activities"
            value={stats.totalActivities.toLocaleString()}
            subtitle="All time"
            icon={Activity}
            color={STAT_CARD_COLORS.totalActivities.bg}
          />
          <StatCard
            title="Unique Users"
            value={stats.uniqueUsers.toLocaleString()}
            subtitle="Distinct actors"
            icon={Users}
            color={STAT_CARD_COLORS.uniqueUsers.bg}
          />
          <StatCard
            title="This Week"
            value={stats.thisWeek.toLocaleString()}
            subtitle="Last 7 days"
            icon={CalendarDays}
            color={STAT_CARD_COLORS.thisWeek.bg}
          />
          <StatCard
            title="Today"
            value={stats.today.toLocaleString()}
            subtitle={new Date().toLocaleDateString("en-GB")}
            icon={Clock}
            color={STAT_CARD_COLORS.today.bg}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted/10 rounded-xl p-4 md:p-5">
              <Skeleton className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Action Breakdown */}
      {stats && stats.actionBreakdown.length > 0 && (
        <Card className="shadow-sm rounded-lg border-0 bg-card">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Actions Breakdown
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.actionBreakdown.map((item) => {
                const meta = getActionMeta(item.action);
                const Icon = meta.icon;
                return (
                  <div
                    key={item.action}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${meta.color}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{meta.label}</span>
                    <span className="font-bold tabular-nums">{item.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {getActionMeta(a).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full sm:w-40"
            />
            <Button onClick={() => { setPage(1); logsQuery.refetch(); }}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="bg-muted/10 rounded-xl p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-full sm:w-20" />
              <Skeleton className="h-4 w-full sm:w-36" />
              <Skeleton className="h-4 w-full sm:w-24" />
              <Skeleton className="h-4 w-full sm:w-48" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden min-w-0">
            <div className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">No activity found</div>
              ) : (
                logs.map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const Icon = meta.icon;
                  const actorName = entry.userName || entry.userEmail || "System";
                  const isError = entry.action.startsWith("api.error");
                  const statusCode = entry.metadata?.statusCode as number | undefined;
                  const detail = isError
                    ? `HTTP ${statusCode ?? "?"}${typeof entry.metadata?.message === "string" ? ` · ${entry.metadata.message}` : ""}`
                    : entry.details || "";
                  const endpoint = getEndpoint(entry);
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-muted/40 transition-colors">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">{actorName}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            entry.userId
                              ? "bg-status-processing/10 text-status-processing"
                              : "bg-status-approved/10 text-status-approved"
                          }`}>
                            {entry.userId ? "Admin" : "System"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                          {endpoint && (
                            <span className="text-[11px] text-text-tertiary font-mono truncate max-w-[20rem]">{endpoint}</span>
                          )}
                        </div>
                        {detail && <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{detail}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-text-tertiary whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleDateString("en-GB")}{" "}
                          {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {entry.ipAddress && (
                          <p className="text-[10px] text-text-tertiary/60 mt-0.5">{entry.ipAddress}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
