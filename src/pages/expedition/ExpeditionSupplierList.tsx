import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Search, X, Globe, CheckCircle, ExternalLink, Building2, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/shared/SafeImage";
import { SectionError } from "@/components/shared/SectionError";
import { staggerContainer, fadeIn, fadeInDown, fadeInUp } from "@/lib/animations";
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
    <div className="rounded-xl border border-border/80 bg-surface-base p-5 shadow-soft animate-pulse">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-14 w-full rounded-lg" />
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="space-y-6"
    >
      {/* Hero */}
      <motion.div
        variants={fadeInDown}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950 p-6 text-white shadow-lg sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <Globe className="pointer-events-none absolute -bottom-8 -right-4 h-48 w-48 text-white/5" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20">
              <Globe className="h-3.5 w-3.5" />
              Expedition Go
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">Tour Distribution</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Control which supplier tours are published on Expedition Go and manage direct booking availability, all from one place.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Distribution</p>
              <p className="text-sm font-semibold">
                {isLoading ? "Loading…" : isError ? "Needs attention" : `${formatNumber(stats.active)} tours live`}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      {hasData && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {[
            { label: "Suppliers", value: stats.total, icon: Building2, color: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/40" },
            { label: "On Expedition", value: stats.onExp, icon: Globe, color: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40" },
            { label: "Active on EG", value: stats.active, icon: CheckCircle, color: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/40" },
            { label: "Direct Booking", value: stats.direct, icon: ExternalLink, color: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/40" },
          ].map((k) => (
            <motion.div
              key={k.label}
              variants={fadeIn}
              className={`rounded-lg shadow-sm border-0 p-5 ${k.color}`}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-border bg-surface-base"
        >
          <SectionError message="Failed to load suppliers" onRetry={() => refetch()} />
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SupplierCardSkeleton key={i} />)}
        </div>
      )}

      {/* Supplier cards */}
      {hasData && suppliers.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {suppliers.map((supplier) => {
            const live = supplier.activeOnExpedition > 0;
            return (
              <motion.button
                key={supplier.id}
                variants={fadeInUp}
                whileHover={{ y: -3, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectSupplier(supplier)}
                className="group relative w-full rounded-xl border border-border/80 bg-surface-base p-5 text-left shadow-soft transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <SafeImage
                      src={supplier.photoURL || undefined}
                      alt={supplier.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                      fallback={
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white ring-2 ring-emerald-100 dark:ring-emerald-800">
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

                <div className="mt-4 grid grid-cols-3 divide-x divide-border/70 rounded-lg border border-border/70 bg-surface-muted/40 py-2">
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tabular-nums">{formatNumber(supplier.totalTours)}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">Tours</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tabular-nums">{formatNumber(supplier.onExpedition)}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">On EG</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-sm font-semibold text-text-primary tabular-nums">{formatNumber(supplier.directCount)}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">Direct</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      live ? "bg-status-active/10 text-status-active" : "bg-surface-muted text-text-tertiary"
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
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Empty */}
      {hasData && suppliers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/40 py-16 text-center"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Building2 className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-semibold text-text-primary">No suppliers found</p>
          <p className="mt-1 text-xs text-text-secondary">
            {search ? "Try a different search term" : "No suppliers with tours yet"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
