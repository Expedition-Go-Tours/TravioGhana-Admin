import { memo, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Globe, ExternalLink, Star, Eye, Search, X, RefreshCw, AlertCircle, Building2, ChevronRight,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/shared/SafeImage";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { staggerContainer, fadeIn } from "@/lib/animations";
import { formatNumber, formatDate } from "@/lib/utils";
import api from "@/lib/axios";
import { toggleSupplierExpeditionRole } from "@/services/supplierService";

interface Supplier {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
  totalTours: number;
  onExpedition: number;
  activeOnExpedition: number;
  directCount: number;
  roles?: string[];
}

interface ExpeditionTour {
  id: string;
  isActive: boolean;
  bookingFlow: "DIRECT" | "EXTERNAL";
  externalUrl: string | null;
  isFeatured: boolean;
  displayOrder: number;
  syncStatus: string | null;
  lastSyncAt: string | null;
  syncError: string | null;
  publishedAt: string | null;
  publishedBy: { id: string; name: string } | null;
  unpublishedAt: string | null;
  unpublishReason: string | null;
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  coverPhoto: string | null;
  status: string;
  category: string | null;
  totalBookings: number;
  averageRating: number;
  createdAt: string;
  expeditionTour: ExpeditionTour | null;
}

interface SupplierToursProps {
  supplier: Supplier;
  onBack: () => void;
}

interface TourRowProps {
  tour: Tour;
  isPending: boolean;
  onToggle: (tour: Tour) => void;
  onOpen: (tourId: string) => void;
}

const TourRow = memo(function TourRow({ tour, isPending, onToggle, onOpen }: TourRowProps) {
  const et = tour.expeditionTour;
  const isPublished = et?.isActive ?? false;

  const syncMeta =
    et?.syncStatus === "synced"
      ? { dot: "bg-status-active", label: "Synced" }
      : et?.syncStatus === "failed"
        ? { dot: "bg-status-rejected", label: "Sync failed" }
        : et?.syncStatus === "pending" || et?.syncStatus === "syncing"
          ? { dot: "bg-amber-400", label: "Syncing" }
          : et
            ? { dot: "bg-text-tertiary/50", label: "Not synced" }
            : { dot: "bg-text-tertiary/50", label: "Off EG" };

  return (
    <div
      onClick={() => onOpen(tour.id)}
      className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted/40"
    >
      <SafeImage
        src={tour.coverPhoto || undefined}
        alt={tour.title}
        className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/60"
        fallback={
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
            <Globe className="h-4 w-4 text-text-tertiary" />
          </div>
        }
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-primary">
            {tour.title}
          </p>
          {et?.isFeatured && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
              Featured
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-tertiary">
          <span className={`font-medium ${tour.status === "ACTIVE" ? "text-status-active" : "text-text-secondary"}`}>
            {tour.status?.replace(/_/g, " ") || "—"}
          </span>
          {tour.category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-text-tertiary/40" />
              {tour.category}
            </span>
          )}
          {tour.averageRating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-amber-600">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {Number(tour.averageRating).toFixed(1)}
            </span>
          )}
          {tour.totalBookings > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-text-tertiary/40" />
              {formatNumber(tour.totalBookings)} bookings
            </span>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1.5 lg:flex">
        {et && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              et.bookingFlow === "DIRECT"
                ? "bg-primary/10 text-primary"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {et.bookingFlow === "DIRECT" ? "DIRECT" : "EXTERNAL"}
          </span>
        )}
        <div className="group/sync relative inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${syncMeta.dot}`} />
          <span className="text-[10px] font-medium text-text-tertiary">{syncMeta.label}</span>
          {et?.syncError && (
            <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 z-10 hidden group-hover/sync:block">
              <div className="max-w-[220px] rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg">
                {et.syncError}
              </div>
            </div>
          )}
        </div>
        {et?.publishedAt && (
          <span className="text-[10px] text-text-tertiary">{formatDate(et.publishedAt)}</span>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          role="switch"
          aria-checked={isPublished}
          aria-label={isPublished ? `Unpublish ${tour.title}` : `Publish ${tour.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(tour);
          }}
          disabled={isPending}
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/30 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
            isPublished ? "bg-primary" : "bg-text-tertiary/30"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              isPublished ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`text-[10px] font-medium ${isPublished ? "text-status-active" : "text-text-tertiary"}`}>
          {isPublished ? "Live" : "Hidden"}
        </span>
      </div>
    </div>
  );
});

function TourRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4 animate-pulse">
      <Skeleton className="h-11 w-11 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-10 rounded-full" />
    </div>
  );
}

export default function ExpeditionSupplierTours({ supplier, onBack }: SupplierToursProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<{ tourId: string; title: string; publish: boolean } | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "expedition-supplier-tours", supplier.id, statusFilter],
    queryFn: () => api.get(`/admin/expedition/suppliers/${supplier.id}/tours?status=${statusFilter}`).then((r) => r.data?.data),
  });

  const tours: Tour[] = useMemo(() => data?.tours || [], [data]);
  const supplierDetail = data?.supplier;

  const supplierRoles = Array.isArray(supplierDetail?.roles) ? supplierDetail.roles : supplier.roles ?? [];
  const isExpeditionPartner = supplierRoles.includes("expedition");

  const publishMut = useMutation({
    mutationFn: ({ tourId, isActive }: { tourId: string; isActive: boolean }) =>
      api.patch(`/admin/tours/${tourId}/expedition-publish`, { isActive }),
    onSuccess: () => {
      toast.success("Updated on Expedition Go");
      queryClient.invalidateQueries({ queryKey: ["admin", "expedition-supplier-tours", supplier.id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "expedition-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "expedition-listings"] });
      setConfirmTarget(null);
    },
    onError: () => toast.error("Failed to update"),
  });

  const roleMut = useMutation({
    mutationFn: ({ enabled }: { enabled: boolean }) => toggleSupplierExpeditionRole(supplier.id, enabled),
    onSuccess: () => {
      toast.success("Supplier booking type updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "expedition-supplier-tours", supplier.id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "expedition-suppliers"] });
    },
    onError: () => toast.error("Failed to update supplier booking type"),
  });

  const stats = useMemo(() => {
    const total = tours.length;
    const onEG = tours.filter((t) => t.expeditionTour?.isActive).length;
    const direct = tours.filter((t) => t.expeditionTour?.bookingFlow === "DIRECT").length;
    const synced = tours.filter((t) => t.expeditionTour?.syncStatus === "synced").length;
    return { total, onEG, direct, synced };
  }, [tours]);

  const syncStats = useMemo(() => {
    let synced = 0;
    let failed = 0;
    let pending = 0;
    let never = 0;
    for (const t of tours) {
      const st = t.expeditionTour?.syncStatus;
      if (st === "synced") synced += 1;
      else if (st === "failed") failed += 1;
      else if (st === "pending" || st === "syncing") pending += 1;
      else never += 1;
    }
    return { synced, failed, pending, never };
  }, [tours]);

  const lastSyncedAt = useMemo(() => {
    const times = tours
      .map((t) => t.expeditionTour?.lastSyncAt)
      .filter((v): v is string => Boolean(v));
    if (!times.length) return null;
    return times.reduce((a, b) => (a > b ? a : b));
  }, [tours]);

  const filteredTours = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tours;
    return tours.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.category?.toLowerCase().includes(q) ?? false),
    );
  }, [tours, search]);

  const handleToggle = useCallback((tour: Tour) => {
    const currentlyActive = tour.expeditionTour?.isActive ?? false;
    setConfirmTarget({
      tourId: tour.id,
      title: tour.title,
      publish: !currentlyActive,
    });
  }, []);

  const handleOpen = useCallback((tourId: string) => {
    navigate(`/admin/tours/${tourId}`);
  }, [navigate]);

  const kpiColor = {
    emerald: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20",
    amber: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20",
  };

  const kpis = [
    { label: "Total Tours", value: stats.total, icon: Globe, accent: "blue" as const },
    { label: "On Expedition Go", value: stats.onEG, icon: CheckCircle, accent: "emerald" as const },
    { label: "Direct Booking", value: stats.direct, icon: ExternalLink, accent: "amber" as const },
    { label: "Synced", value: stats.synced, icon: Eye, accent: "emerald" as const },
  ];

  const live = supplier.activeOnExpedition > 0 || stats.onEG > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-base text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Back to suppliers"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-medium text-text-secondary">Expedition Go</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-medium text-text-primary">{supplier.name}</span>
      </div>

      {/* Supplier profile header */}
      <div className="rounded-2xl border border-border bg-surface-base p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <SafeImage
                src={supplierDetail?.photoURL || supplier.photoURL || undefined}
                alt={supplier.name}
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
                fallback={
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold text-white">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>
                }
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface-base ${
                  live ? "bg-status-active" : "bg-text-tertiary/50"
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-text-primary sm:text-xl">{supplier.name}</h1>
              </div>
              <p className="mt-0.5 truncate text-sm text-text-tertiary">{supplierDetail?.email || supplier.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    live ? "bg-status-active/10 text-status-active" : "bg-surface-muted text-text-tertiary"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-status-active" : "bg-text-tertiary/50"}`} />
                  {live ? "Live on Expedition Go" : "Offline"}
                </span>
                {lastSyncedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] text-text-tertiary">
                    <RefreshCw className="h-3 w-3" />
                    Synced {formatDate(lastSyncedAt)}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    isExpeditionPartner
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {isExpeditionPartner ? "Direct booking" : "External booking"}
                </span>
              </div>

              {/* Expedition partner toggle — controls DIRECT vs EXTERNAL booking flow */}
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 px-3.5 py-2.5">
                <button
                  role="switch"
                  aria-checked={isExpeditionPartner}
                  aria-label={isExpeditionPartner ? "Disable direct booking on Expedition Go" : "Enable direct booking on Expedition Go"}
                  onClick={() => roleMut.mutate({ enabled: !isExpeditionPartner })}
                  disabled={roleMut.isPending}
                  title="Controls the booking flow (DIRECT vs EXTERNAL) for new publications on Expedition Go"
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/30 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
                    isExpeditionPartner ? "bg-primary" : "bg-text-tertiary/30"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      isExpeditionPartner ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary">Expedition partner</p>
                  <p className="text-[11px] text-text-tertiary">
                    {isExpeditionPartner
                      ? "Tours publish with DIRECT booking on Expedition Go"
                      : "Tours publish as EXTERNAL (redirect to Travio Ghana)"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[340px]">
            {[
              { label: "Tours", value: formatNumber(supplier.totalTours), icon: Building2 },
              { label: "On EG", value: formatNumber(supplier.onExpedition), icon: Globe },
              { label: "Direct", value: formatNumber(supplier.directCount), icon: ExternalLink },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/70 bg-surface-muted/40 px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                  <s.icon className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-xs font-medium text-text-secondary">{s.label}</p>
                </div>
                <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {kpis.map((k) => (
          <motion.div
            key={k.label}
            variants={fadeIn}
            className={`rounded-lg shadow-sm border-0 p-5 ${kpiColor[k.accent]}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                <p className="text-3xl font-bold tracking-tight text-text-primary">{formatNumber(k.value)}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <k.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Distribution health */}
      {!isLoading && !isError && (
        <div className="rounded-xl border border-border bg-surface-base p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Distribution health</h3>
            <span className="text-xs text-text-tertiary">{tours.length} tour{tours.length !== 1 ? "s" : ""} on this supplier</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Published", value: stats.onEG, dot: "bg-status-active" },
              { label: "Synced", value: syncStats.synced, dot: "bg-emerald-400" },
              { label: "Pending", value: syncStats.pending + syncStats.never, dot: "bg-amber-400" },
              { label: "Failed", value: syncStats.failed, dot: "bg-status-rejected" },
            ].map((h) => (
              <div key={h.label} className="rounded-lg border border-border/70 bg-surface-muted/40 px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${h.dot}`} />
                  <p className="text-xs font-medium text-text-secondary">{h.label}</p>
                </div>
                <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{h.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search tours…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            {filteredTours.length} of {tours.length} shown
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ACTIVE">Active only</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-base shadow-soft">
          <div className="border-b border-border/70 px-5 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => <TourRowSkeleton key={i} />)}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-rejected/10">
            <AlertCircle className="h-6 w-6 text-status-rejected" />
          </div>
          <p className="text-sm font-semibold text-text-primary">Failed to load tours</p>
          <p className="mt-1 text-xs text-text-secondary">We couldn't fetch this supplier's tours. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Tour list */}
      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-base shadow-soft">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Tours</h3>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                {tours.length}
              </span>
            </div>
            {filteredTours.length !== tours.length && (
              <button onClick={() => setSearch("")} className="text-xs font-medium text-primary hover:underline">
                Clear filter
              </button>
            )}
          </div>

          {tours.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <Globe className="h-6 w-6 text-text-tertiary" />
              </div>
              <p className="text-sm font-semibold text-text-primary">No tours from this supplier</p>
              <p className="mt-1 text-xs text-text-secondary">This supplier has no tours to publish on Expedition Go.</p>
            </div>
          ) : filteredTours.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Search className="mb-2 h-7 w-7 text-text-tertiary" />
              <p className="text-sm font-semibold text-text-primary">No tours match your search</p>
              <button onClick={() => setSearch("")} className="mt-1 text-xs font-medium text-primary hover:underline">
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredTours.map((tour) => (
                <TourRow
                  key={tour.id}
                  tour={tour}
                  isPending={publishMut.isPending}
                  onToggle={handleToggle}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* External link hint */}
      {tours.some((t) => t.expeditionTour?.externalUrl) && (
        <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <ExternalLink className="h-3 w-3 shrink-0" />
          Tours with EXTERNAL flow redirect to Travio Ghana. Only DIRECT flow suppliers book through the platform.
        </p>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={!!confirmTarget}
        icon={confirmTarget?.publish ? "publish" : "unpublish"}
        title={confirmTarget?.publish ? "Publish to Expedition Go" : "Unpublish from Expedition Go"}
        description={
          confirmTarget?.publish
            ? `"${confirmTarget?.title}" will go live on Expedition Go Tours. The booking flow (DIRECT or EXTERNAL) is auto-detected based on the supplier's account type.`
            : `"${confirmTarget?.title}" will be removed from Expedition Go Tours and hidden from the marketplace.`
        }
        confirmLabel={confirmTarget?.publish ? "Publish" : "Unpublish"}
        confirmVariant={confirmTarget?.publish ? "default" : "destructive"}
        loading={publishMut.isPending}
        onConfirm={() => {
          if (confirmTarget) {
            publishMut.mutate({ tourId: confirmTarget.tourId, isActive: confirmTarget.publish });
          }
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </motion.div>
  );
}
