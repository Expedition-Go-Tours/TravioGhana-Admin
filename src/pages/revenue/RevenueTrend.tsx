import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, Percent, Banknote, CalendarRange, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { chartColors, chartAxis } from "@/components/shared/chartTheme";
import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";
import api from "@/lib/axios";
import { formatCurrency } from "@/lib/utils";

const METRICS = [
  { key: "revenue", label: "Revenue", color: chartColors.blue },
  { key: "commission", label: "Commission", color: chartColors.green },
  { key: "supplierPayout", label: "Supplier Payout", color: chartColors.amber },
];

export default function RevenueTrendPage() {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    revenue: true,
    commission: true,
    supplierPayout: true,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "revenue-trend"],
    queryFn: () => api.get("/admin/analytics/revenue-trend").then((r) => r.data),
  });

  const months = useMemo(() => data?.data?.months || [], [data?.data?.months]);

  const totals = useMemo(() => {
    return METRICS.reduce(
      (acc, m) => {
        acc[m.key] = months.reduce((s: number, row: Record<string, number>) => s + (Number(row[m.key]) || 0), 0);
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [months]);

  const avgMonthly = months.length ? (totals.revenue || 0) / months.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Trend"
        subtitle="Gross booking revenue, platform commission and supplier payouts across the last 24 months"
      />

      <PageInsight icon={<Wallet className="h-4 w-4" />} title="How the money flows">
        Revenue is what customers pay across all bookings on the platform. Commission is the slice the platform keeps, your actual earnings, while supplier payout is what gets forwarded to the tour operators running each experience. Read the chart top to bottom: a strong month should grow all three, but keep an eye on the commission to revenue ratio. If revenue climbs and commission doesn't, the mix has shifted toward lower commission tours.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Total Revenue"
          value={isLoading ? "..." : formatCurrency(totals.revenue)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Gross value of all bookings"
        />
        <StatCard
          label="Total Commission"
          value={isLoading ? "..." : formatCurrency(totals.commission)}
          icon={<Percent className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="The platform share you keep"
        />
        <StatCard
          label="Supplier Payout"
          value={isLoading ? "..." : formatCurrency(totals.supplierPayout)}
          icon={<Banknote className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle="Forwarded to tour operators"
        />
        <StatCard
          label="Avg Revenue / Month"
          value={isLoading ? "..." : formatCurrency(avgMonthly)}
          icon={<CalendarRange className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Mean gross per month"
        />
      </motion.div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <DollarSign className="h-4 w-4 text-primary" />
            Monthly Revenue Breakdown
          </CardTitle>
          <div className="flex flex-wrap gap-4 pt-2">
            {METRICS.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={visible[m.key]}
                  onChange={() => setVisible((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
                  className="rounded border-border text-primary focus:ring-text-secondary/30"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
              </label>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : isError ? (
            <SectionError message="Failed to load revenue trend" onRetry={() => refetch()} />
          ) : !months.length ? (
            <SectionEmpty message="No revenue data for the last 24 months" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={months} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={{ stroke: chartAxis.axis }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  content={<ChartTooltip formatter={(value) => formatCurrency(Number(value))} />}
                  cursor={{ fill: "hsl(var(--surface-muted) / 0.4)" }}
                />
                {METRICS.filter((m) => visible[m.key]).map((m) => (
                  <Bar key={m.key} dataKey={m.key} fill={m.color} name={m.label} radius={[4, 4, 0, 0]} maxBarSize={40} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
