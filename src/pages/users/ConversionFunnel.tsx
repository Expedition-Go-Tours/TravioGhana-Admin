import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Eye, ShoppingCart, CreditCard, CheckCircle, TrendingUp, ArrowRight, ArrowDown, Users, Route } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

const STEPS = [
  { key: "viewed", label: "Tour Viewed", icon: Eye, color: chartColors.blue },
  { key: "cart_added", label: "Added to Cart", icon: ShoppingCart, color: chartColors.amber },
  { key: "checkout_started", label: "Checkout Started", icon: CreditCard, color: chartColors.violet },
  { key: "booking_completed", label: "Booking Completed", icon: CheckCircle, color: chartColors.green },
];

const STEP_DATAKEY_MAP: Record<string, string> = {
  "tour.viewed": "views",
  "cart.added": "cartAdds",
  "booking.initiated": "checkouts",
  "booking.completed": "bookings",
};

const LEGEND = [
  { key: "views", label: "Views", color: chartColors.blue },
  { key: "cartAdds", label: "Cart Adds", color: chartColors.amber },
  { key: "checkouts", label: "Checkouts", color: chartColors.violet },
  { key: "bookings", label: "Bookings", color: chartColors.green },
];

interface FunnelStep {
  step?: string;
  users?: number;
  dropOff?: number | string;
}

export default function ConversionFunnelPage() {
  const [period, setPeriod] = useState("30d");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "funnel", period],
    queryFn: () => api.get(`/admin/analytics/funnel?period=${period}`).then((r) => r.data),
  });

  const funnel = (data?.data?.funnel || data?.funnel || []) as FunnelStep[];
  const conversionRates = data?.data?.conversionRates || data?.conversionRates;
  const rawDaily = useMemo(() => data?.data?.dailyTrend || data?.dailyTrend || [], [data]);
  const firstUsers = funnel[0]?.users || 1;

  const dailyTrend = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    for (const row of rawDaily) {
      const raw = row.day as string;
      const day = raw ? String(raw).slice(0, 10) : raw;
      if (!map.has(day)) map.set(day, { date: day, views: 0, cartAdds: 0, checkouts: 0, bookings: 0 });
      const entry = map.get(day)!;
      const dk = STEP_DATAKEY_MAP[row.name as string];
      if (dk) entry[dk] = ((entry[dk] as number) || 0) + ((row.users as number) || 0);
    }
    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [rawDaily]);

  const isLoadingValue = isLoading || false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion Funnel"
        subtitle="From first tour view to completed booking, where each step loses users"
      >
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <PageInsight icon={<Route className="h-4 w-4" />} title="Find the leak, fix it first">
        The funnel tracks every user from first tour view through to a completed booking. Each step shows how many made it and how many dropped off. The biggest gap between two steps is your single highest impact friction point, and the one to tackle first. Overall is the headline number, how well the entire journey converts. Compare periods to see whether changes to listings, pricing, or checkout actually move the needle.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="View to Cart"
          value={isLoadingValue ? "..." : conversionRates?.viewToCart != null ? `${conversionRates.viewToCart.toFixed(1)}%` : "—"}
          icon={<ArrowRight className="h-5 w-5" />}
          accent="blue"
          loading={isLoadingValue}
          subtitle="Views that led to adding a tour"
        />
        <StatCard
          label="Cart to Checkout"
          value={isLoadingValue ? "..." : conversionRates?.cartToCheckout != null ? `${conversionRates.cartToCheckout.toFixed(1)}%` : "—"}
          icon={<ArrowRight className="h-5 w-5" />}
          accent="amber"
          loading={isLoadingValue}
          subtitle="Carts that reached checkout"
        />
        <StatCard
          label="Checkout to Complete"
          value={isLoadingValue ? "..." : conversionRates?.checkoutToComplete != null ? `${conversionRates.checkoutToComplete.toFixed(1)}%` : "—"}
          icon={<ArrowRight className="h-5 w-5" />}
          accent="emerald"
          loading={isLoadingValue}
          subtitle="Checkouts that became bookings"
        />
        <StatCard
          label="Overall (View to Book)"
          value={isLoadingValue ? "..." : conversionRates?.overall != null ? `${conversionRates.overall.toFixed(1)}%` : "—"}
          icon={<CheckCircle className="h-5 w-5" />}
          accent="emerald"
          loading={isLoadingValue}
          subtitle="View to completed booking"
        />
      </motion.div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Users className="h-4 w-4 text-primary" />
            User Journey Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingValue ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : isError ? (
            <SectionError message="Failed to load funnel data" onRetry={() => refetch()} />
          ) : !funnel.length ? (
            <SectionEmpty message="No funnel data for this period" />
          ) : (
            <div className="space-y-6">
              {funnel.map((step, idx) => {
                const info = STEPS[idx];
                const Icon = info?.icon || CheckCircle;
                const pct = ((step.users || 0) / firstUsers) * 100;
                const prevUsers = idx > 0 ? (funnel[idx - 1]?.users || 0) : 0;
                const dropOff = idx > 0 && prevUsers > 0
                  ? `${(100 - ((step.users || 0) / prevUsers) * 100).toFixed(1)}%`
                  : null;
                return (
                  <div key={step.step}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${info?.color}18` }}>
                        <Icon className="h-5 w-5" style={{ color: info?.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-text-primary">{info?.label || step.step}</p>
                          <p className="text-lg font-bold text-text-primary">{formatNumber(step.users)}</p>
                        </div>
                        <div className="mt-1.5 h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: info?.color }} />
                        </div>
                      </div>
                      <div className="w-28 text-right shrink-0">
                        <p className="text-xs text-text-tertiary">{pct.toFixed(1)}% of top</p>
                        {idx > 0 && dropOff && (
                          <p className="mt-0.5 text-xs text-status-rejected flex items-center justify-end gap-1">
                            <ArrowDown className="h-3 w-3" />
                            {dropOff} drop-off
                          </p>
                        )}
                      </div>
                    </div>
                    {idx < funnel.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="h-4 w-4 text-text-tertiary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Event Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingValue ? (
            <Skeleton className="h-72 w-full" />
          ) : isError ? (
            <SectionError message="Failed to load daily trend" onRetry={() => refetch()} />
          ) : !dailyTrend.length ? (
            <SectionEmpty message="No daily trend data for this period" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={{ stroke: chartAxis.axis }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(value) => formatNumber(Number(value))} />} cursor={{ stroke: chartAxis.reference, strokeDasharray: "3 3" }} />
                  {LEGEND.map((item) => (
                    <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} name={item.label} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 pt-3">
                {LEGEND.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
