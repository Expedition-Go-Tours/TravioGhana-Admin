import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search, X, Users, UserCheck, Clock, UserX, Star, Building2, MapPin, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { usePermission } from "@/hooks/usePermission";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import { cn, formatCurrency, formatNumber, formatDate, supplierTypeLabel } from "@/lib/utils";
import api from "@/lib/axios";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Supplier {
  id: string;
  user?: { id?: string; name?: string; email?: string; photoURL?: string };
  businessInfo?: {
    legalBusinessName?: string; businessName?: string; displayName?: string; businessType?: string;
    country?: string; city?: string; state?: string; address?: string | { line1?: string; city?: string; state?: string };
  };
  status?: string;
  supplierType?: string;
  totalBookings?: number;
  totalEarnings?: string | number;
  averageRating?: string | number;
  createdAt?: string;
}

type StatusKey = "ALL" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "EXPIRED";

const TABS: { key: StatusKey; label: string; match: (s: string) => boolean }[] = [
  { key: "ALL", label: "All", match: () => true },
  { key: "PENDING", label: "Pending", match: (s) => s === "PENDING" },
  { key: "UNDER_REVIEW", label: "Under Review", match: (s) => s === "UNDER_REVIEW" },
  { key: "APPROVED", label: "Approved", match: (s) => s === "APPROVED" },
  { key: "ACTIVE", label: "Active", match: (s) => s === "ACTIVE" },
  { key: "SUSPENDED", label: "Suspended", match: (s) => s === "SUSPENDED" },
  { key: "REJECTED", label: "Rejected", match: (s) => s === "REJECTED" },
  { key: "EXPIRED", label: "Expired", match: (s) => s === "EXPIRED" },
];

const TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "TOUR_GUIDE", label: "Tour Guides" },
  { value: "TOUR_COMPANY", label: "Tour Companies" },
  { value: "TRANSPORTATION_PROVIDER", label: "Transportation" },
  { value: "VEHICLE_OPERATOR", label: "Vehicle Operators" },
  { value: "ACCOMMODATION_PROVIDER", label: "Accommodation" },
  { value: "OTHER_SERVICE_PROVIDER", label: "Other" },
];

const PAGE_SIZE = 12;

function businessName(s: Supplier): string {
  return s.businessInfo?.legalBusinessName || s.businessInfo?.businessName || s.businessInfo?.displayName || s.user?.name || "—";
}

function businessLocation(s: Supplier): string {
  const city = s.businessInfo?.city || (typeof s.businessInfo?.address === "object" ? s.businessInfo.address?.city : undefined);
  return [city, s.businessInfo?.country].filter(Boolean).join(", ");
}

function SupplierCard({
  s,
  canSuspend,
  onView,
  onSuspendAction,
}: {
  s: Supplier;
  canSuspend: boolean;
  onView: () => void;
  onSuspendAction: () => void;
}) {
  const name = s.user?.name || "—";
  const initial = name.charAt(0).toUpperCase();
  const isPending = s.status === "PENDING" || s.status === "UNDER_REVIEW";
  const hasRating = s.averageRating != null && Number(s.averageRating) > 0;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-base p-4 transition-colors hover:bg-surface-muted/30 cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white">
          <span>{initial}</span>
          {s.user?.photoURL && (
            <OptimizedImage
              src={s.user.photoURL}
              alt={name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              width={40}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
              <p className="truncate text-xs text-text-tertiary">{s.user?.email}</p>
            </div>
            <StatusBadge status={s.status || "UNKNOWN"} />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{businessName(s)}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{businessLocation(s) || "—"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-1 font-medium text-text-secondary">
          {supplierTypeLabel(s.supplierType)}
        </span>
        <span className="tabular-nums text-text-secondary">{formatNumber(s.totalBookings)} bookings</span>
        <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(s.totalEarnings)}</span>
        {hasRating ? (
          <span className="inline-flex items-center gap-1 tabular-nums text-text-primary">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(s.averageRating).toFixed(1)}
          </span>
        ) : (
          <span className="text-text-tertiary">No ratings</span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-xs text-text-tertiary">Joined {formatDate(s.createdAt)}</span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onView}>
            {isPending ? "Review" : "View"}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
          {canSuspend && (s.status === "ACTIVE" || s.status === "SUSPENDED") && (
            <Button
              size="sm"
              variant={s.status === "ACTIVE" ? "destructive" : "default"}
              onClick={onSuspendAction}
            >
              {s.status === "ACTIVE" ? "Suspend" : "Reactivate"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<StatusKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [actionTarget, setActionTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  useSocketInvalidate("admin:supplier-application", ["admin", "suppliers"]);
  useSocketInvalidate("admin:supplier-status-change", ["admin", "suppliers"]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "suppliers", "all"],
    queryFn: () => api.get("/suppliers/admin/applications?limit=1000").then((r) => r.data),
  });

  const rawApplications: Supplier[] = useMemo(
    () => data?.data?.applications || data?.applications || [],
    [data],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rawApplications.length };
    for (const t of TABS) if (t.key !== "ALL") c[t.key] = 0;
    for (const s of rawApplications) {
      const st = s.status || "UNKNOWN";
      if (c[st] != null) c[st] += 1;
    }
    return c;
  }, [rawApplications]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    const query = searchQuery.toLowerCase().trim();
    return rawApplications.filter((s) => {
      if (!tab.match(s.status || "")) return false;
      if (typeFilter && s.supplierType !== typeFilter) return false;
      if (!query) return true;
      return [
        s.user?.name, s.user?.email,
        s.businessInfo?.legalBusinessName, s.businessInfo?.businessName, s.businessInfo?.displayName,
        s.businessInfo?.businessType, s.businessInfo?.country, s.businessInfo?.city,
        typeof s.businessInfo?.address === "object" ? s.businessInfo.address?.city : undefined,
      ].some((f) => f?.toLowerCase().includes(query));
    });
  }, [rawApplications, activeTab, searchQuery, typeFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    const getVal = (s: Supplier): string | number => {
      if (sortKey === "name") return (s.user?.name || businessName(s)).toLowerCase();
      if (sortKey === "bookings") return Number(s.totalBookings) || 0;
      if (sortKey === "earnings") return Number(s.totalEarnings) || 0;
      if (sortKey === "rating") return Number(s.averageRating) || -1;
      return 0;
    };
    arr.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const toggleMutation = useMutation({
    mutationFn: (body: { suspend: boolean; reason?: string }) =>
      api.patch(`/suppliers/admin/${actionTarget?.id}/suspend`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast.success(actionTarget?.status === "ACTIVE" ? "Supplier suspended" : "Supplier reactivated");
      setActionTarget(null);
      setSuspendReason("");
    },
    onError: () => toast.error("Failed to update supplier status"),
  });

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      sortable: true,
      render: (r) => {
        const name = r.user?.name || "—";
        const initial = name.charAt(0).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white">
              <span>{initial}</span>
              {r.user?.photoURL && (
                <OptimizedImage
                  src={r.user.photoURL}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-cover"
                  width={36}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{name}</p>
              <p className="truncate text-xs text-text-tertiary">{r.user?.email || "—"}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "business",
      header: "Business",
      render: (r) => (
        <div className="min-w-0 max-w-[240px]">
          <p className="truncate text-sm font-medium text-text-primary">{businessName(r)}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{businessLocation(r) || "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-text-secondary">
          {supplierTypeLabel(r.supplierType)}
        </span>
      ),
    },
    {
      key: "bookings",
      header: "Bookings",
      sortable: true,
      align: "right",
      render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatNumber(r.totalBookings)}</span>,
    },
    {
      key: "earnings",
      header: "Earnings",
      sortable: true,
      align: "right",
      render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(r.totalEarnings)}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      align: "right",
      render: (r) =>
        r.averageRating != null && Number(r.averageRating) > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums text-text-primary">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {Number(r.averageRating).toFixed(1)}
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">No ratings</span>
        ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status || "UNKNOWN"} /> },
    { key: "createdAt", header: "Joined", render: (r) => <span className="text-xs text-text-tertiary">{formatDate(r.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => {
        const isPending = r.status === "PENDING" || r.status === "UNDER_REVIEW";
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/suppliers/${r.id}`); }}
            >
              {isPending ? "Review" : "View"}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
            {can("suppliers.suspend") && (r.status === "ACTIVE" || r.status === "SUSPENDED") && (
              <Button
                size="sm"
                variant={r.status === "ACTIVE" ? "destructive" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  setActionTarget({ id: r.id, name: r.user?.name || "Unknown", status: r.status || "" });
                  setSuspendReason("");
                }}
              >
                {r.status === "ACTIVE" ? "Suspend" : "Reactivate"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const emptyMessage = activeTab === "ALL" ? "No suppliers yet" : `No ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} suppliers`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Every supplier on the platform, from new applications to live operators"
      />

      <PageInsight icon={<Building2 className="h-4 w-4" />} title="The supply side of the marketplace">
        Suppliers are the businesses behind every tour customers book. New applications only become inventory once you approve them, so a long Pending queue quietly slows your catalog. Active suppliers keep listings live, while Suspended accounts have been taken offline. Keep the review pipeline moving and watch the Active number to gauge marketplace health.
      </PageInsight>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Suppliers"
          value={isLoading ? "..." : formatNumber(rawApplications.length)}
          icon={<Users className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Across all statuses"
          onClick={() => { setActiveTab("ALL"); setSearchQuery(""); }}
        />
        <StatCard
          label="Active"
          value={isLoading ? "..." : formatNumber(counts.ACTIVE)}
          icon={<UserCheck className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Live on the marketplace"
          onClick={() => { setActiveTab("ACTIVE"); setSearchQuery(""); }}
        />
        <StatCard
          label="Pending Review"
          value={isLoading ? "..." : formatNumber((counts.PENDING || 0) + (counts.UNDER_REVIEW || 0))}
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle="Awaiting your decision"
          onClick={() => { setActiveTab("UNDER_REVIEW"); setSearchQuery(""); }}
        />
        <StatCard
          label="Suspended"
          value={isLoading ? "..." : formatNumber(counts.SUSPENDED)}
          icon={<UserX className="h-5 w-5" />}
          accent="red"
          loading={isLoading}
          subtitle="Taken offline"
          onClick={() => { setActiveTab("SUSPENDED"); setSearchQuery(""); }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Search + count */}
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="text-xs text-text-tertiary sm:ml-auto">
              {formatNumber(filtered.length)} of {formatNumber(rawApplications.length)} suppliers
            </div>
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:px-5 sm:gap-2 scrollbar-thin">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-text-tertiary">Type</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setTypeFilter(f.value); setPage(1); }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3",
                  typeFilter === f.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:border-primary/40 hover:text-text-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:px-5 sm:gap-1 sm:py-3 scrollbar-thin">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3.5",
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                )}
              >
                {tab.label}
                <span className={cn("ml-1 tabular-nums", activeTab === tab.key ? "text-primary" : "text-text-tertiary")}>
                  {formatNumber(counts[tab.key] || 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={pageData}
              loading={isLoading}
              error={isError ? "Failed to load suppliers" : null}
              emptyMessage={emptyMessage}
              onRowClick={(row) => navigate(`/admin/suppliers/${row.id}`)}
              sortBy={sortKey || undefined}
              sortOrder={sortDir}
              onSort={handleSort}
              onRetry={() => refetch()}
              keyExtractor={(r) => r.id}
              pagination={{
                page: currentPage,
                totalPages,
                totalCount: sorted.length,
                pageSize: PAGE_SIZE,
                onPageChange: setPage,
              }}
            />
          </div>

          {/* Mobile card list */}
          <div className="md:hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                        <div className="h-2.5 w-32 bg-gray-100 rounded" />
                      </div>
                    </div>
                    <div className="h-3 w-40 bg-gray-100 rounded" />
                    <div className="flex gap-3">
                      <div className="h-5 w-16 bg-gray-100 rounded" />
                      <div className="h-5 w-20 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                <p className="text-sm">Failed to load suppliers</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : pageData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                <p className="text-sm">{emptyMessage}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {pageData.map((s) => (
                  <SupplierCard
                    key={s.id}
                    s={s}
                    canSuspend={can("suppliers.suspend")}
                    onView={() => navigate(`/admin/suppliers/${s.id}`)}
                    onSuspendAction={() => {
                      setActionTarget({ id: s.id, name: s.user?.name || "Unknown", status: s.status || "" });
                      setSuspendReason("");
                    }}
                  />
                ))}
              </div>
            )}

            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                <p className="text-xs text-text-tertiary">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Prev
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {actionTarget && (
        <ConfirmModal
          open={!!actionTarget}
          title={actionTarget.status === "ACTIVE" ? "Suspend Supplier" : "Reactivate Supplier"}
          description={
            actionTarget.status === "ACTIVE"
              ? `Are you sure you want to suspend ${actionTarget.name}? Their tours will be removed from the marketplace immediately.`
              : `Reactivate ${actionTarget.name}? Their tours will become bookable again.`
          }
          confirmLabel={actionTarget.status === "ACTIVE" ? "Suspend" : "Reactivate"}
          confirmVariant={actionTarget.status === "ACTIVE" ? "destructive" : "default"}
          loading={toggleMutation.isPending}
          onConfirm={() => {
            if (actionTarget.status === "ACTIVE") {
              toggleMutation.mutate({ suspend: true, reason: suspendReason });
            } else {
              toggleMutation.mutate({ suspend: false });
            }
          }}
          onCancel={() => { setActionTarget(null); setSuspendReason(""); }}
        >
          {actionTarget.status === "ACTIVE" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="suspendReason">Reason (required, min 10 characters)</Label>
              <Textarea
                id="suspendReason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Why is this supplier being suspended?"
                rows={3}
              />
              {suspendReason.length > 0 && suspendReason.length < 10 && (
                <p className="text-xs text-status-rejected">Minimum 10 characters</p>
              )}
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
