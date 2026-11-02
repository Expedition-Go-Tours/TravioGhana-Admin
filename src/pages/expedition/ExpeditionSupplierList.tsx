import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, X, Globe, CheckCircle, ExternalLink, Building2, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/shared/SafeImage";
import { SectionError } from "@/components/shared/SectionError";
import { formatNumber } from "@/lib/utils";
import api from "@/lib/axios";

interface Supplier {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
  totalTours: number;
  onExpedition: number;
  activeOnExpedition: number;
  directCount: number;
}

function SupplierCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-base p-5  animate-pulse">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-14 w-full rounded-xl" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

interface SupplierListProps {
  onSelectSupplier: (supplier: Supplier) => void;
}

export default function ExpeditionSupplierList({ onSelectSupplier }: SupplierListProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "expedition-suppliers"],
    queryFn: () => api.get("/admin/expedition/suppliers").then((r) => r.data?.data?.suppliers as Supplier[]),
  });

  const suppliers = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data;
    return data.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, onExp: 0, active: 0, direct: 0 };
    return {
      total: data.length,
      onExp: data.reduce((a, s) => a + s.onExpedition, 0),
      active: data.reduce((a, s) => a + s.activeOnExpedition, 0),
      direct: data.reduce((a, s) => a + s.directCount, 0),
    };
  }, [data]);

  const hasData = Boolean(!isLoading && !isError && data);

  return (
    <div 
      className="space-y-6">
      {/* Hero */}
      <div 
        className="relative overflow-hidden rounded-xl bg-brand-dark p-6 text-white sm:p-8">
        <Globe className="pointer-events-none absolute -bottom-8 -right-4 h-48 w-48 text-white/5" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20">
              <Globe className="h-3.5 w-3.5" />
              Expedition Go
            </span>
            <h1 className="mt-3 text-[26px] font-light leading-8 tracking-[-0.26px] sm:text-[28px]">Tour Distribution</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Control which supplier tours are published on Expedition Go and manage direct booking availability, all from one place.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 ">
            <span className="h-2.5 w-2.5 rounded-full bg-status-active ring-2 ring-white/20" />
            <div>
              <p className="text-[10px] font-semibold text-white/60">Distribution</p>
              <p className="text-sm font-semibold">
                {isLoading ? "Loading…" : isError ? "Needs attention" : `${formatNumber(stats.active)} tours live`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {hasData && (
        <div 
          className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Suppliers", value: stats.total, icon: Building2, tone: "bg-status-approved/10 text-status-approved-text" },
            { label: "On Expedition", value: stats.onExp, icon: Globe, tone: "bg-primary/10 text-primary" },
            { label: "Active on EG", value: stats.active, icon: CheckCircle, tone: "bg-primary/10 text-primary" },
            { label: "Direct Booking", value: stats.direct, icon: ExternalLink, tone: "bg-status-pending/10 text-status-pending-text" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-surface-base p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[13px] font-medium leading-snug text-text-tertiary">{k.label}</p>
                  <p className="tnum text-[26px] font-light leading-tight tracking-[-0.26px] text-text-primary">{formatNumber(k.value)}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search suppliers…"
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

        {hasData && (
          <p className="text-xs text-text-secondary">
            Showing <span className="font-semibold text-text-primary">{suppliers.length}</span> of{" "}
            <span className="font-semibold text-text-primary">{data?.length ?? 0}</span> suppliers
            {search && suppliers.length !== (data?.length ?? 0) && (
              <button onClick={() => setSearch("")} className="ml-2 font-medium text-primary hover:underline">
                Clear filter
              </button>
            )}
          </p>
        )}
      </div>

      {/* Error */}
      {isError && (
        <div 
          className="rounded-xl border border-border bg-surface-base">
          <SectionError message="Failed to load suppliers" onRetry={() => refetch()} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SupplierCardSkeleton key={i} />)}
        </div>
      )}

      {/* Supplier cards */}
      {hasData && suppliers.length > 0 && (
        <div 
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => {
            const live = supplier.activeOnExpedition > 0;
            return (
              <button
                key={supplier.id} 
                onClick={() => onSelectSupplier(supplier)}
                className="group relative w-full rounded-xl border border-border bg-surface-base p-5 text-left  transition-colors hover:border-primary/40">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <SafeImage
                      src={supplier.photoURL || undefined}
                      alt={supplier.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                      fallback={
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-primary/30 dark:ring-primary/30">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface-base ${
                        live ? "bg-status-active" : "bg-text-tertiary/60"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{supplier.name}</p>
                    <p className="truncate text-xs text-text-tertiary">{supplier.email}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border bg-surface-muted py-2">
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tnum">{formatNumber(supplier.totalTours)}</p>
                    <p className="text-[10px] font-medium text-text-tertiary">Tours</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tnum">{formatNumber(supplier.onExpedition)}</p>
                    <p className="text-[10px] font-medium text-text-tertiary">On EG</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tnum">{formatNumber(supplier.directCount)}</p>
                    <p className="text-[10px] font-medium text-text-tertiary">Direct</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      live ? "bg-status-active/10 text-status-active-text" : "bg-surface-muted text-text-tertiary"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-status-active" : "bg-text-tertiary/50"}`} />
                    {live ? "Live on Expedition Go" : "Offline"}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-text-tertiary transition-colors group-hover:text-primary">
                    Manage
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {hasData && suppliers.length === 0 && (
        <div 
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Building2 className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-semibold text-text-primary">No suppliers found</p>
          <p className="mt-1 text-xs text-text-secondary">
            {search ? "Try a different search term" : "No suppliers with tours yet"}
          </p>
        </div>
      )}
    </div>
  );
}