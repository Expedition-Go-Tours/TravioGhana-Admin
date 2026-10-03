import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock, CalendarDays, PauseCircle, AlertTriangle, Search, X, Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/**
 * Payout schedules — the supplier-selectable cadences (weekly / twice a month /
 * monthly). Shows who is enrolled, when their next run lands and what it will pay.
 *
 * This tab is read-only by design. A supplier's cadence is theirs to choose in
 * their own dashboard (Settings → Payouts, `PATCH /finance/payout-settings`); the
 * only admin-side control is the platform-wide default for new enrolments in
 * Settings → Commission & Fees. So there is deliberately no per-row edit action
 * here — the `pendingCycle` column surfaces changes a supplier has already
 * scheduled for themselves, which is the only reason it exists.
 */

interface PlanOption {
  value: string;
  shortLabel: string;
  runDays: string;
  label: string;
  description: string;
}

interface PayoutPlan {
  autoManaged: boolean;
  cycle: string | null;
  scheduleLabel: string | null;
  scheduleShortLabel?: string | null;
  nextRunAt: string | null;
  nextRunPeriodLabel: string | null;
  lastRunAt: string | null;
  effectiveAt: string | null;
  pendingCycle: string | null;
  pendingEffectiveAt: string | null;
  defaultCycle: string;
  autoRunsEnabled: boolean;
}

interface ScheduleRow {
  supplierId: string;
  name: string | null;
  email: string | null;
  status: string;
  plan: PayoutPlan;
  eligibleBalance: { amount: number; bookingCount: number; currency: string };
  hasVerifiedMethod: boolean;
}

interface SchedulesPayload {
  schedules?: ScheduleRow[];
  pagination?: { currentPage: number; limit: number; totalCount: number; totalPages: number };
  cycles?: PlanOption[];
  summary?: {
    enrolled: number;
    byCycle: Record<string, number>;
    pendingChanges: number;
    missingVerifiedMethod: number;
    runsNext7Days: number;
  };
  autoRunsEnabled?: boolean;
  defaultCycle?: string;
}

const CYCLE_BADGE: Record<string, string> = {
  WEEKLY: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  TWICE_MONTHLY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  MONTHLY: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const CYCLE_FALLBACK: PlanOption[] = [
  { value: "WEEKLY", shortLabel: "Weekly", runDays: "Every Monday", label: "Every week — paid every Monday", description: "" },
  { value: "TWICE_MONTHLY", shortLabel: "Twice a month", runDays: "The 1st & 15th", label: "Twice a month — paid on the 1st & 15th", description: "" },
  { value: "MONTHLY", shortLabel: "Monthly", runDays: "The 1st of each month", label: "Monthly — paid on the 1st", description: "" },
];

function optionFor(options: PlanOption[], value?: string | null) {
  return options.find((o) => o.value === value) || null;
}

/**
 * How close the next run is — "Today" / "Tomorrow" / "In 4 days". The list is
 * ordered soonest-first, so this makes the top of the queue scannable at a
 * glance. Returns null once the run is more than a week away.
 */
function relativeRunLabel(value: string | null): { label: string; today: boolean } | null {
  if (!value) return null;
  const run = new Date(value);
  if (Number.isNaN(run.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOf(run).getTime() - startOf(new Date()).getTime()) / 86_400_000);
  if (days <= 0) return { label: "Today", today: true };
  if (days === 1) return { label: "Tomorrow", today: true };
  if (days <= 7) return { label: `In ${days} days`, today: false };
  return null;
}

export function PayoutSchedulesTab() {
  const [page, setPage] = useState(1);
  const [cycle, setCycle] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const limit = 20;

  useSocketInvalidate("admin:payout-request-update", ["admin", "payout-schedules"]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery<SchedulesPayload>({
    queryKey: ["admin", "payout-schedules", { page, cycle, search: debounced }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (cycle !== "all") params.set("cycle", cycle);
      if (debounced) params.set("search", debounced);
      return api.get(`/admin/finance/payout-schedules?${params.toString()}`).then((r) => r.data?.data || {});
    },
  });

  const options = data?.cycles?.length ? data.cycles : CYCLE_FALLBACK;
  const rows = useMemo(() => data?.schedules || [], [data]);
  const summary = data?.summary;
  const paused = data?.autoRunsEnabled === false;

  const columns: Column<ScheduleRow>[] = [
    {
      key: "supplier",
      header: "Supplier",
      rowHeader: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{r.name || r.email || "Unknown"}</p>
          <p className="truncate text-xs text-text-tertiary">{r.email}</p>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (r) => (
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", CYCLE_BADGE[r.plan.cycle || ""] || "bg-surface-muted text-text-secondary")}>
          {optionFor(options, r.plan.cycle)?.shortLabel || r.plan.cycle || "—"}
        </span>
      ),
    },
    {
      key: "next",
      header: "Next payout",
      render: (r) => {
        const soon = relativeRunLabel(r.plan.nextRunAt);
        return (
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm tabular-nums text-text-primary">{r.plan.nextRunAt ? formatDate(r.plan.nextRunAt) : "—"}</p>
              {soon && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                    soon.today
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  )}
                >
                  {soon.label}
                </span>
              )}
            </div>
            {r.plan.nextRunPeriodLabel && (
              <p className="text-xs text-text-tertiary">covering {r.plan.nextRunPeriodLabel}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "eligible",
      header: "Eligible now",
      numeric: true,
      render: (r) => (
        <div>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(r.eligibleBalance?.amount || 0, r.eligibleBalance?.currency || "USD")}
          </p>
          <p className="text-xs tabular-nums text-text-tertiary">
            {r.eligibleBalance?.bookingCount || 0} booking{r.eligibleBalance?.bookingCount === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (r) =>
        r.hasVerifiedMethod ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-status-active-text">
            <Check className="h-3.5 w-3.5" aria-hidden /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-rejected/10 px-1.5 py-0.5 text-[11px] font-semibold text-status-rejected-text">
            <AlertTriangle className="h-3 w-3" aria-hidden /> No verified method
          </span>
        ),
    },
    {
      key: "pending",
      header: "Scheduled change",
      hideBelow: "lg",
      render: (r) =>
        r.plan.pendingCycle ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            {optionFor(options, r.plan.pendingCycle)?.shortLabel || r.plan.pendingCycle}
            <span className="font-normal tabular-nums">· {formatDate(r.plan.pendingEffectiveAt)}</span>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled Suppliers"
          value={isLoading ? "..." : String(summary?.enrolled ?? 0)}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="emerald"
          subtitle={data?.defaultCycle ? `Default: ${optionFor(options, data.defaultCycle)?.shortLabel || data.defaultCycle}` : undefined}
        />
        <StatCard
          label="Runs in Next 7 Days"
          value={isLoading ? "..." : String(summary?.runsNext7Days ?? 0)}
          icon={<CalendarDays className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Scheduled Changes"
          value={isLoading ? "..." : String(summary?.pendingChanges ?? 0)}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Missing Payout Method"
          value={isLoading ? "..." : String(summary?.missingVerifiedMethod ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="red"
          subtitle={isLoading ? undefined : "Enrolled suppliers who can't be paid yet"}
        />
      </div>

      {paused && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Automatic payout runs are <strong>paused</strong> (Settings → Commission &amp; Fees). Enrolled suppliers keep
            their schedule and can request a payout manually until it is switched back on.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={cycle} onValueChange={(v) => { setCycle(v); setPage(1); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All schedules</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.shortLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs tabular-nums text-text-tertiary">
              {rows.length} of {data?.pagination?.totalCount ?? rows.length} suppliers · soonest payout first
            </span>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            loading={isLoading}
            error={isError ? "Failed to load payout schedules" : null}
            emptyMessage={debounced ? "No suppliers match your search" : "No suppliers are on an automatic payout schedule yet"}
            pagination={data?.pagination ? {
              page: data.pagination.currentPage || page,
              totalPages: data.pagination.totalPages || 1,
              totalCount: data.pagination.totalCount || 0,
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.supplierId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
