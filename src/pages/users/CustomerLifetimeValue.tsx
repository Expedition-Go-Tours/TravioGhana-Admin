import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Users, CalendarCheck, DollarSign, Repeat, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { chartColors } from "@/components/shared/chartTheme";
import api from "@/lib/axios";
import { staggerContainer } from "@/lib/animations";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

const DIST_COLORS = [chartColors.blue, chartColors.green, chartColors.amber, chartColors.violet, chartColors.red];

const BOOKING_LABELS: Record<string, string> = {
  "1": "1 Booking",
  "2": "2 Bookings",
  "3": "3 Bookings",
  "4": "4 Bookings",
  "5+": "5+ Bookings",
};

interface CLVData {
  overview?: { totalCustomers?: number; totalBookings?: number; avgBookingValue?: number; totalRevenue?: number; avgCLV?: number };
  repeatRate?: { percent?: number; avgBookingsPerCustomer?: number; repeatRate?: number };
  distribution?: Array<{ bookingCount?: string; customers?: number; percentage?: number }>;
  topCustomers?: Array<{ id?: string; name?: string; email?: string; totalBookings?: number; totalSpent?: number; avgBookingValue?: number; lastBookingDate?: string }>;
  cohorts?: Array<{ month?: string; users?: number; bookings?: number; revenue?: number; bookingsPerUser?: number; revenuePerUser?: number }>;
}

export default function CustomerLifetimeValuePage() {
  const { data, isLoading, isError, refetch } = useQuery<CLVData & { data?: CLVData }>({
    queryKey: ["admin", "clv"],
    queryFn: () => api.get("/admin/analytics/clv").then((r) => r.data),
  });

  const topColumns: Column<{ id?: string; name?: string; email?: string; totalBookings?: number; totalSpent?: number; avgBookingValue?: number; lastBookingDate?: string }>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-text-primary">{r.name || "—"}</span> },
    { key: "email", header: "Email", render: (r) => <span className="text-text-secondary">{r.email || "—"}</span> },
    { key: "totalBookings", header: "Bookings", align: "right", render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatNumber(r.totalBookings)}</span> },
    { key: "totalSpent", header: "Total Spent", align: "right", render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(r.totalSpent)}</span> },
    { key: "avgBookingValue", header: "Avg Value", align: "right", render: (r) => <span className="text-text-secondary tabular-nums">{formatCurrency(r.avgBookingValue)}</span> },
    { key: "lastBookingDate", header: "Last Booking", render: (r) => <span className="text-xs text-text-tertiary">{formatDate(r.lastBookingDate)}</span> },
  ];

  const cohortColumns: Column<{ month?: string; users?: number; bookings?: number; revenue?: number; bookingsPerUser?: number; revenuePerUser?: number }>[] = [
    { key: "month", header: "Month", render: (r) => <span className="font-medium text-text-primary">{r.month || "—"}</span> },
    { key: "users", header: "Users", align: "right", render: (r) => <span className="tabular-nums">{formatNumber(r.users)}</span> },
    { key: "bookings", header: "Bookings", align: "right", render: (r) => <span className="tabular-nums">{formatNumber(r.bookings)}</span> },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(r.revenue)}</span> },
    { key: "bookingsPerUser", header: "Bookings/User", align: "right", render: (r) => <span className="tabular-nums">{r.bookingsPerUser?.toFixed(2) || "—"}</span> },
    { key: "revenuePerUser", header: "Revenue/User", align: "right", render: (r) => <span className="text-text-secondary tabular-nums">{formatCurrency(r.revenuePerUser)}</span> },
  ];

  const chartData = data?.data?.distribution || data?.distribution || [];
  const overview = data?.data?.overview ?? data?.overview;
  const repeatRate = data?.data?.repeatRate ?? data?.repeatRate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Lifetime Value"
        subtitle="How much customers are worth over time, and which segments drive that value"
      />

      <PageInsight icon={<Repeat className="h-4 w-4" />} title="Why repeat customers matter">
        Customer lifetime value is the total revenue one customer brings across all their bookings. Avg CLV equals total revenue divided by total customers. The strongest lever on CLV is retention. A customer who books twice is worth far more than two one time customers, which is exactly what Repeat Rate measures. Use the cohorts table to see which acquisition months produced loyal, high value users, then double down on the channels and campaigns that brought them in.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatCard label="Total Customers" value={isLoading ? "..." : formatNumber(overview?.totalCustomers)} icon={<Users className="h-5 w-5" />} accent="blue" loading={isLoading} subtitle="Registered customer accounts" />
        <StatCard label="Total Bookings" value={isLoading ? "..." : formatNumber(overview?.totalBookings)} icon={<CalendarCheck className="h-5 w-5" />} accent="emerald" loading={isLoading} subtitle="Completed bookings to date" />
        <StatCard label="Avg Booking Value" value={isLoading ? "..." : formatCurrency(overview?.avgBookingValue)} icon={<ShoppingBag className="h-5 w-5" />} accent="amber" loading={isLoading} subtitle="Mean spend per completed booking" />
        <StatCard label="Total Revenue" value={isLoading ? "..." : formatCurrency(overview?.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} accent="emerald" loading={isLoading} subtitle="Lifetime gross booking value" />
        <StatCard label="Avg CLV" value={isLoading ? "..." : formatCurrency(overview?.avgCLV)} icon={<Repeat className="h-5 w-5" />} accent="blue" loading={isLoading} subtitle="Lifetime revenue per customer" />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Repeat className="h-4 w-4 text-primary" />
              Repeat Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : isError ? (
              <SectionError message="Failed to load repeat rate" onRetry={() => refetch()} />
            ) : (
              <div className="text-center py-2">
                <p className="text-4xl font-bold text-text-primary">{repeatRate?.repeatRate?.toFixed(1) || "0"}%</p>
                <p className="text-sm text-text-secondary mt-1">of customers book more than once</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="text-text-secondary">Avg <strong className="text-primary">{repeatRate?.avgBookingsPerCustomer?.toFixed(2) || "0"}</strong> bookings per customer</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-text-primary">Booking Distribution</CardTitle>
              {!isLoading && !isError && chartData.length > 0 && (
                <span className="text-xs text-text-tertiary">
                  {chartData.reduce((s, d) => s + (d.customers || 0), 0).toLocaleString()} total customers
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : isError ? (
              <SectionError message="Failed to load distribution" onRetry={() => refetch()} />
            ) : !chartData.length ? (
              <SectionEmpty message="No distribution data" />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <ResponsiveContainer width="100%" height={200} className="max-w-[220px] shrink-0">
                  <PieChart>
                    <Pie data={chartData} dataKey="customers" nameKey="bookingCount" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {chartData.map((_, idx) => (
                        <Cell key={idx} fill={DIST_COLORS[idx % DIST_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, entry) => [
                        `${formatNumber(Number(value))} (${entry.payload.percentage?.toFixed(1) || "0"}%)`,
                        BOOKING_LABELS[entry.payload.bookingCount as string] || entry.payload.bookingCount,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3 w-full">
                  {chartData.map((entry, idx) => {
                    const total = chartData.reduce((s, d) => s + (d.customers || 0), 0);
                    const pct = entry.percentage ?? (total > 0 ? ((entry.customers ?? 0) / total) * 100 : 0);
                    return (
                      <div key={entry.bookingCount}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: DIST_COLORS[idx % DIST_COLORS.length] }} />
                            <span className="font-medium text-text-primary">{BOOKING_LABELS[entry.bookingCount as string] || entry.bookingCount}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-semibold text-text-primary tabular-nums">{formatNumber(entry.customers)}</span>
                            <span className="text-text-tertiary tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: DIST_COLORS[idx % DIST_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text-primary">Top 20 Customers</CardTitle>
            <span className="text-xs text-text-tertiary">Highest spenders</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={topColumns}
            data={data?.data?.topCustomers || data?.topCustomers || []}
            loading={isLoading}
            error={isError ? "Failed to load customers" : null}
            emptyMessage="No customer data"
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id || r.email || Math.random().toString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text-primary">Monthly Cohorts</CardTitle>
            <span className="text-xs text-text-tertiary">Acquisition cohort performance</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={cohortColumns}
            data={data?.data?.cohorts || data?.cohorts || []}
            loading={isLoading}
            error={isError ? "Failed to load cohorts" : null}
            emptyMessage="No cohort data"
            onRetry={() => refetch()}
            keyExtractor={(r) => r.month || Math.random().toString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
