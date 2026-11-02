import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, CalendarRange, DollarSign, Percent, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { chartAxis, chartColors } from "@/components/shared/chartTheme";
import api from "@/lib/axios";
import { cn, formatCurrency } from "@/lib/utils";

type Range = 6 | 12 | 24;

interface RevenueMonth {
  month: string;
  label: string;
  revenue: number;
  commission: number;
  supplierPayout: number;
}

const METRICS = [
  { key: "revenue", label: "Revenue", color: chartColors.emerald },
  { key: "commission", label: "Commission", color: chartColors.primary },
  { key: "supplierPayout", label: "Supplier payout", color: chartColors.gold },
] as const;

const RANGES: Range[] = [6, 12, 24];

const formatMonth = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatCompact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
};

export default function RevenueTrendPage() {
  const [range, setRange] = useState<Range>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 6 : 12,
  );
  const [visible, setVisible] = useState<Record<string, boolean>>({
    revenue: true,
    commission: true,
    supplierPayout: true,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "revenue-trend"],
    queryFn: () => api.get("/admin/analytics/revenue-trend").then((r) => r.data),
  });

  const months = useMemo<RevenueMonth[]>(
    () =>
      ((data?.data?.months || []) as Array<Record<string, unknown>>).map((row) => ({
        month: String(row.month || ""),
        label: formatMonth(String(row.month || "")),
        revenue: Number(row.revenue) || 0,
        commission: Number(row.commission) || 0,
        supplierPayout: Number(row.supplierPayout) || 0,
      })),
    [data?.data?.months],
  );

  const visibleMonths = useMemo(() => months.slice(-range), [months, range]);

  const totals = useMemo(
    () =>
      METRICS.reduce(
        (acc, metric) => {
          acc[metric.key] = visibleMonths.reduce((sum, row) => sum + row[metric.key], 0);
          return acc;
        },
        {} as Record<(typeof METRICS)[number]["key"], number>,
      ),
    [visibleMonths],
  );

  const avgMonthly = visibleMonths.length ? totals.revenue / visibleMonths.length : 0;
  const commissionRate = totals.revenue > 0 ? (totals.commission / totals.revenue) * 100 : 0;
  const payoutShare = totals.revenue > 0 ? (totals.supplierPayout / totals.revenue) * 100 : 0;

  const peakMonth = useMemo(
    () =>
      visibleMonths.reduce<RevenueMonth | null>(
        (peak, row) => (!peak || row.revenue > peak.revenue ? row : peak),
        null,
      ),
    [visibleMonths],
  );

  const toggleMetric = (key: string) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  const hasData = visibleMonths.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Trend"
        subtitle="Gross booking revenue, platform commission, and supplier payouts by month"
      >
        <div className="flex rounded-full border border-border bg-surface-base p-1" role="group" aria-label="Chart range">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                range === value
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "font-medium text-text-tertiary hover:bg-surface-muted hover:text-text-primary",
              )}
            >
              {value}M
            </button>
          ))}
        </div>
      </PageHeader>

      <PageInsight icon={<Wallet className="h-4 w-4" />} title="How the money flows">
        Gross revenue is what customers pay. Commission is the platform's share; the
        remainder is forwarded to suppliers. A widening gap between commission and
        payout means the booking mix is shifting toward higher-commission tours.
      </PageInsight>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`Revenue (${range}M)`}
          value={isError ? "—" : formatCurrency(totals.revenue)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Gross value of all bookings"
        />
        <StatCard
          label="Commission"
          value={isError ? "—" : formatCurrency(totals.commission)}
          icon={<Percent className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle={isLoading ? undefined : `${commissionRate.toFixed(1)}% of gross revenue`}
        />
        <StatCard
          label="Supplier payout"
          value={isError ? "—" : formatCurrency(totals.supplierPayout)}
          icon={<Banknote className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle={isLoading ? undefined : `${payoutShare.toFixed(1)}% of gross revenue`}
        />
        <StatCard
          label="Avg revenue / month"
          value={isError ? "—" : formatCurrency(avgMonthly)}
          icon={<CalendarRange className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle={isLoading ? undefined : `Across ${visibleMonths.length} month${visibleMonths.length === 1 ? "" : "s"}`}
        />
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-text-primary">
                Revenue, commission, and payout
              </CardTitle>
              <p className="mt-1 text-xs text-text-tertiary">
                {peakMonth && hasData ? (
                  <>
                    Peak month: <span className="font-semibold text-text-secondary">{peakMonth.label}</span>
                    {" at "}
                    <span className="tnum font-semibold text-text-secondary">{formatCurrency(peakMonth.revenue)}</span>
                  </>
                ) : (
                  "Monthly totals for the selected range"
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visible series">
              {METRICS.map((metric) => {
                const active = visible[metric.key];
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => toggleMetric(metric.key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-border bg-surface-base font-semibold text-text-primary"
                        : "border-transparent bg-surface-muted font-medium text-text-tertiary hover:text-text-secondary",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: active ? metric.color : "hsl(var(--text-tertiary))" }}
                    />
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : isError ? (
            <SectionError message="Failed to load revenue trend" onRetry={() => refetch()} />
          ) : !hasData ? (
            <SectionEmpty message="No revenue data for this range" />
          ) : (
            <div className="h-[300px] w-full min-w-0 sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleMonths} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: chartAxis.tick }}
                    axisLine={{ stroke: chartAxis.axis }}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartAxis.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tickFormatter={(value) => formatCompact(Number(value))}
                  />
                  <Tooltip
                    content={<ChartTooltip formatter={(value) => formatCurrency(Number(value))} />}
                    cursor={{ fill: "hsl(var(--text-primary) / 0.04)" }}
                  />
                  {METRICS.filter((metric) => visible[metric.key]).map((metric) => (
                    <Bar
                      key={metric.key}
                      dataKey={metric.key}
                      fill={metric.color}
                      name={metric.label}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
