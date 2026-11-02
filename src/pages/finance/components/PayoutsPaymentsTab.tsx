import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Percent,
  Send,
  Table2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { chartColors, chartAxis } from "@/components/shared/chartTheme";
import { SectionError } from "@/components/shared/SectionError";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import api from "@/lib/axios";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const RANGE_OPTIONS = [6, 12, 24] as const;
type Range = (typeof RANGE_OPTIONS)[number];
type ActivityView = "chart" | "table";

interface MonthlyPoint {
  month: string;
  label: string;
  count?: number;
  totalAmount?: number;
  commission?: number;
}

function monthLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function QueueRow({
  title,
  description,
  icon,
  count,
  total,
  oldestDays,
  loading,
  tone,
  onView,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  oldestDays: number | null;
  loading: boolean;
  tone: "approval" | "transfer";
  onView: () => void;
}) {
  const toneClass =
    tone === "approval"
      ? "bg-status-pending/10 text-status-pending-text"
      : "bg-status-processing/10 text-status-processing-text";

  return (
    <button
      type="button"
      onClick={onView}
      className="group flex w-full flex-col gap-4 p-5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClass)}>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-tertiary">{description}</p>
          </div>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <p className="tnum text-[26px] font-semibold leading-none tracking-[-0.02em] text-text-primary">
              {formatCurrency(total)}
            </p>
          )}
          <p className="mt-1.5 text-xs text-text-tertiary">
            {loading
              ? "Loading queue"
              : count > 0
                ? `${formatNumber(count)} ${count === 1 ? "request" : "requests"}`
                : "Nothing waiting"}
          </p>
        </div>
        {!loading && oldestDays != null && count > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
            <Clock className="h-3 w-3" />
            Oldest {oldestDays}d
          </span>
        )}
      </div>
    </button>
  );
}

export function PayoutsPaymentsTab({
  onSwitchToRequests,
  onSwitchToList,
}: {
  onSwitchToRequests: () => void;
  onSwitchToList?: (status?: string) => void;
}) {
  useSocketInvalidate("admin:payout-update", ["admin", "payout-summary"]);
  useSocketInvalidate("admin:payout-request-update", ["admin", "payout-summary"]);

  const [range, setRange] = useState<Range>(12);
  const [view, setView] = useState<ActivityView>("chart");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payout-summary"],
    queryFn: () => api.get("/payouts/admin/summary").then((r) => r.data),
  });

  // Finance v2: the live queues are batch payout requests. Legacy per-booking
  // payouts still exist for pre-v2 history and are folded in as secondary
  // counts so no in-flight money is hidden from the operator.
  const legacyPending = data?.data?.pending || {};
  const legacyProcessing = data?.data?.processing || {};
  const reqQueues = data?.data?.requests || {};
  const awaitingApproval = {
    count: (reqQueues.awaitingApproval?.count ?? 0) + (legacyPending.count ?? 0),
    total: (reqQueues.awaitingApproval?.total ?? 0) + (legacyPending.total ?? 0),
  };
  const approvedInFlight = {
    count: (reqQueues.approvedAwaitingTransfer?.count ?? 0) + (legacyProcessing.count ?? 0),
    total: (reqQueues.approvedAwaitingTransfer?.total ?? 0) + (legacyProcessing.total ?? 0),
  };
  const paidThisMonth = data?.data?.paidThisMonth || {};
  const outstanding = data?.data?.outstanding || {};
  const failed = data?.data?.failed || {};
  const avgCommission = Number(data?.data?.avgCommission ?? 0);

  const { data: oldestApprovalData } = useQuery({
    queryKey: ["admin", "payout-requests", "oldest", "PROCESSING"],
    queryFn: () => api.get("/admin/finance/payout-requests?status=PROCESSING&limit=1").then((r) => r.data),
  });
  const { data: oldestApprovedData } = useQuery({
    queryKey: ["admin", "payout-requests", "oldest", "APPROVED"],
    queryFn: () => api.get("/admin/finance/payout-requests?status=APPROVED&limit=1").then((r) => r.data),
  });

  const oldestAge = useCallback((createdAt?: string): number | null => {
    if (!createdAt) return null;
    return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  }, []);

  const approvalAge = oldestAge(oldestApprovalData?.data?.requests?.[0]?.createdAt);
  const transferAge = oldestAge(oldestApprovedData?.data?.requests?.[0]?.createdAt);

  const monthly = useMemo<MonthlyPoint[]>(() => {
    const raw = (data?.data?.monthlyBreakdown || data?.monthlyBreakdown || []) as {
      month: string;
      count?: number;
      totalAmount?: number;
      commission?: number;
    }[];
    const sorted = [...raw].sort((a, b) => a.month.localeCompare(b.month));
    const sliced = range === 24 ? sorted : sorted.slice(-range);
    return sliced.map((point) => ({ ...point, label: monthLabel(point.month) }));
  }, [data, range]);

  const totals = useMemo(
    () =>
      monthly.reduce(
        (acc, point) => ({
          amount: acc.amount + (point.totalAmount ?? 0),
          commission: acc.commission + (point.commission ?? 0),
          count: acc.count + (point.count ?? 0),
        }),
        { amount: 0, commission: 0, count: 0 },
      ),
    [monthly],
  );

  const avgCommissionPct = useMemo(() => {
    if (totals.amount > 0) return ((totals.commission / totals.amount) * 100).toFixed(1);
    return null;
  }, [totals]);

  const failedCount = Number(failed.count ?? 0);
  const failedTotal = Number(failed.total ?? 0);

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <SectionError message="We could not load the payout overview." onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Outstanding to suppliers"
          value={formatCurrency(Number(outstanding.total ?? 0))}
          icon={<Wallet className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle={
            isLoading
              ? undefined
              : `${formatNumber(Number(outstanding.count ?? 0))} paid ${Number(outstanding.count ?? 0) === 1 ? "booking" : "bookings"} awaiting payout`
          }
        />
        <StatCard
          label="Paid this month"
          value={formatCurrency(Number(paidThisMonth.total ?? 0))}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle={isLoading ? undefined : `${formatNumber(Number(paidThisMonth.count ?? 0))} settled payouts`}
        />
        <StatCard
          label="Commission this month"
          value={formatCurrency(Number(paidThisMonth.commission ?? 0))}
          icon={<Percent className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle={
            isLoading
              ? undefined
              : avgCommission > 0
                ? `${(avgCommission * 100).toFixed(1)}% average rate`
                : "No commission recorded yet"
          }
        />
        <StatCard
          label="Failed payouts"
          value={formatNumber(failedCount)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="red"
          loading={isLoading}
          subtitle={
            isLoading
              ? undefined
              : failedCount > 0
                ? `${formatCurrency(failedTotal)} needs review`
                : "Nothing needs fixing"
          }
          onClick={failedCount > 0 ? () => onSwitchToList?.("FAILED") : undefined}
        />
      </div>

      {failedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-status-rejected/25 bg-status-rejected/5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-rejected/10 text-status-rejected-text">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-status-rejected-text">
                {failedCount} failed {failedCount === 1 ? "payout" : "payouts"} need attention
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {formatCurrency(failedTotal)} did not reach suppliers. Review the failure reason and retry.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => onSwitchToList?.("FAILED")}
          >
            Review failed <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Money waiting on finance</p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Requests move from approval to transfer before they settle.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-text-tertiary" onClick={onSwitchToRequests}>
            Open requests <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <QueueRow
            title="Awaiting approval"
            description="Withdrawals waiting for finance to authorise them."
            icon={<Clock className="h-4 w-4" />}
            count={awaitingApproval.count}
            total={awaitingApproval.total}
            oldestDays={approvalAge}
            loading={isLoading}
            tone="approval"
            onView={onSwitchToRequests}
          />
          <QueueRow
            title="Approved · awaiting transfer"
            description="Authorised payouts that have not been sent yet."
            icon={<Send className="h-4 w-4" />}
            count={approvedInFlight.count}
            total={approvedInFlight.total}
            oldestDays={transferAge}
            loading={isLoading}
            tone="transfer"
            onView={onSwitchToRequests}
          />
        </div>
      </Card>

      <Card>
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <TrendingUp className="h-4 w-4 text-primary" />
                Payout activity
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
                {isLoading
                  ? "Loading settled payouts"
                  : monthly.length > 0
                    ? `${formatCurrency(totals.amount)} paid across ${formatNumber(totals.count)} payouts · ${formatCurrency(totals.commission)} commission${avgCommissionPct ? ` (${avgCommissionPct}%)` : ""}`
                    : "Settled payouts will appear here once money has moved."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-3 pr-1 text-[11px] text-text-tertiary sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.green }} />
                  Paid
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.amber }} />
                  Commission
                </span>
              </div>

              <div className="inline-flex rounded-full border border-border bg-surface-base p-0.5" role="group" aria-label="Activity range">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    aria-pressed={range === option}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      range === option
                        ? "bg-primary text-primary-foreground"
                        : "text-text-tertiary hover:text-text-primary",
                    )}
                  >
                    {option}M
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-full border border-border bg-surface-base p-0.5" role="group" aria-label="Activity view">
                <button
                  type="button"
                  onClick={() => setView("chart")}
                  aria-pressed={view === "chart"}
                  title="Chart view"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    view === "chart" ? "bg-surface-muted text-text-primary" : "text-text-tertiary hover:text-text-primary",
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="sr-only">Chart view</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("table")}
                  aria-pressed={view === "table"}
                  title="Table view"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    view === "table" ? "bg-surface-muted text-text-primary" : "text-text-tertiary hover:text-text-primary",
                  )}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Table view</span>
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : monthly.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-muted text-text-tertiary">
                <TrendingUp className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-text-primary">No payout history yet</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-tertiary">
                Once a payout settles, its paid amount and commission appear here by month.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onSwitchToRequests}>
                Review payout requests
              </Button>
            </div>
          ) : view === "chart" ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: chartAxis.tick }}
                    axisLine={{ stroke: chartAxis.axis }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    yAxisId="paid"
                    tick={{ fontSize: 11, fill: chartAxis.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={70}
                  />
                  <YAxis
                    yAxisId="commission"
                    orientation="right"
                    tick={{ fontSize: 11, fill: chartAxis.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      formatCurrency(Number(value)).replace(/\.00$/, "")
                    }
                    width={60}
                  />
                  <Tooltip
                    content={<ChartTooltip formatter={(value) => formatCurrency(Number(value))} />}
                    cursor={{ fill: chartAxis.reference, fillOpacity: 0.35 }}
                  />
                  <Bar
                    yAxisId="paid"
                    dataKey="totalAmount"
                    fill={chartColors.green}
                    fillOpacity={0.85}
                    name="Paid"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Line
                    yAxisId="commission"
                    type="monotone"
                    dataKey="commission"
                    stroke={chartColors.amber}
                    strokeWidth={2.5}
                    name="Commission"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                      Month
                    </th>
                    <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                      Payouts
                    </th>
                    <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                      Paid
                    </th>
                    <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                      Commission
                    </th>
                    <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...monthly].reverse().map((point) => {
                    const amount = point.totalAmount ?? 0;
                    const pct = amount > 0 ? ((point.commission ?? 0) / amount) * 100 : 0;
                    return (
                      <tr key={point.month} className="transition-colors hover:bg-surface-muted/60">
                        <td className="px-2 py-3 text-[13px] font-medium text-text-primary">{point.label}</td>
                        <td className="tnum px-2 py-3 text-right text-[13px] text-text-secondary">
                          {formatNumber(point.count ?? 0)}
                        </td>
                        <td className="tnum px-2 py-3 text-right text-[13px] font-semibold text-text-primary">
                          {formatCurrency(amount)}
                        </td>
                        <td className="tnum px-2 py-3 text-right text-[13px] text-text-secondary">
                          {formatCurrency(point.commission ?? 0)}
                        </td>
                        <td className="tnum px-2 py-3 text-right text-[13px] text-text-tertiary">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface-muted">
                    <td className="px-2 py-3 text-[13px] font-semibold text-text-primary">Total</td>
                    <td className="tnum px-2 py-3 text-right text-[13px] font-semibold text-text-primary">
                      {formatNumber(totals.count)}
                    </td>
                    <td className="tnum px-2 py-3 text-right text-[13px] font-semibold text-text-primary">
                      {formatCurrency(totals.amount)}
                    </td>
                    <td className="tnum px-2 py-3 text-right text-[13px] font-semibold text-text-primary">
                      {formatCurrency(totals.commission)}
                    </td>
                    <td className="tnum px-2 py-3 text-right text-[13px] font-semibold text-primary">
                      {avgCommissionPct ? `${avgCommissionPct}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
