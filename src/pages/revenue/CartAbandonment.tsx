import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ShoppingCart, X, Percent, TrendingDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { chartColors, chartAxis } from "@/components/shared/chartTheme";
import api from "@/lib/axios";
import { staggerContainer } from "@/lib/animations";
import { formatNumber } from "@/lib/utils";

const periods = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

const legendPayload = [
  { value: "Carts", color: chartColors.amber },
  { value: "Conversions", color: chartColors.green },
  { value: "Abandonment Rate %", color: chartColors.blue },
];

export default function CartAbandonmentPage() {
  const [period, setPeriod] = useState("30d");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "cart-abandonment", period],
    queryFn: () => api.get(`/admin/analytics/cart-abandonment?period=${period}`).then((r) => r.data),
  });

  const overview = data?.data?.overview || data?.overview;
  const dailyTrend = data?.data?.dailyTrend || data?.dailyTrend || [];
  const cartsAbandoned = overview ? (overview.cartsCreated || 0) - (overview.cartsConverted || 0) : 0;

  const byTourColumns: Column<{ tourTitle?: string; cartsAdded?: number; converted?: number; abandonmentRate?: number }>[] = [
    { key: "tourTitle", header: "Tour Name", render: (r) => r.tourTitle || "—" },
    { key: "cartsAdded", header: "Carts Added", sortable: true, align: "right", render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatNumber(r.cartsAdded)}</span> },
    { key: "converted", header: "Converted", sortable: true, align: "right", render: (r) => <span className="font-semibold text-text-primary tabular-nums">{formatNumber(r.converted)}</span> },
    { key: "abandonmentRate", header: "Abandonment Rate", sortable: true, align: "right", render: (r) => r.abandonmentRate != null ? <span className="font-semibold text-status-pending tabular-nums">{r.abandonmentRate.toFixed(1)}%</span> : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cart Abandonment"
        subtitle="Where carts get dropped before a booking is confirmed"
      >
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <PageInsight icon={<ShoppingCart className="h-4 w-4" />} title="Recoverable revenue">
        A cart is abandoned when it's created but never turns into a booking. High abandonment usually signals friction at the final step, such as hidden pricing, unavailable dates, or a clunky checkout. The Abandonment by Tour table is the one to act on. Listings that get added to carts but rarely convert are costing you revenue at the very last moment, so they are the highest leverage fixes in this report.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Carts Created"
          value={isLoading ? "..." : formatNumber(overview?.cartsCreated)}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Carts with at least one tour added"
        />
        <StatCard
          label="Carts Abandoned"
          value={isLoading ? "..." : formatNumber(cartsAbandoned)}
          icon={<X className="h-5 w-5" />}
          accent="red"
          loading={isLoading}
          subtitle="Carts left without a booking"
        />
        <StatCard
          label="Carts Converted"
          value={isLoading ? "..." : formatNumber(overview?.cartsConverted)}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Carts that ended in a booking"
        />
        <StatCard
          label="Abandonment Rate"
          value={isLoading ? "..." : overview?.abandonmentRate != null ? `${overview.abandonmentRate.toFixed(1)}%` : "—"}
          icon={<Percent className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle="Share of carts that never converted"
        />
      </motion.div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingDown className="h-4 w-4 text-status-pending" />
            Daily Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : isError ? (
            <SectionError message="Failed to load daily trend" onRetry={() => refetch()} />
          ) : !dailyTrend.length ? (
            <SectionEmpty message="No daily trend data" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={{ stroke: chartAxis.axis }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={<ChartTooltip formatter={(value, name) => name === "Abandonment Rate %" ? `${Number(value).toFixed(1)}%` : formatNumber(Number(value))} />}
                    cursor={{ stroke: chartAxis.reference, strokeDasharray: "3 3" }}
                  />
                  <Line type="monotone" dataKey="cartsAdded" stroke={legendPayload[0].color} name="Carts" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="converted" stroke={legendPayload[1].color} name="Conversions" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="abandonmentRate" stroke={legendPayload[2].color} name="Abandonment Rate %" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 pt-3">
                {legendPayload.map((entry) => (
                  <div key={entry.value} className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.value}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <TrendingDown className="h-4 w-4 text-status-pending" />
              Abandonment by Tour
            </CardTitle>
            <span className="text-xs text-text-tertiary">Tours with highest cart abandonment</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={byTourColumns}
            data={data?.data?.byTour || data?.byTour || []}
            loading={isLoading}
            error={isError ? "Failed to load tour data" : null}
            emptyMessage="No tour abandonment data"
            onRetry={() => refetch()}
            keyExtractor={(r) => r.tourTitle || Math.random().toString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
