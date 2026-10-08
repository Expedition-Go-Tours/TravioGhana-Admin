import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Eye, CreditCard, CheckCircle, ArrowRight, ArrowDown, TrendingUp,
  Users, Target, Timer, AlertTriangle, DollarSign,
} from "lucide-react";
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
import { formatNumber, formatCurrency } from "@/lib/utils";

const periods = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

/**
 * The honest storefront funnel: Tour Viewed → Checkout Started → Booking
 * Completed. There is deliberately NO cart step — the storefronts have no
 * cart; a seat hold (CheckoutDraft) IS the checkout start and a created
 * booking IS the completion. Backend sources checkouts/bookings from those
 * tables directly so phantom steps and fabricated rates can never appear.
 */
const STEP_META = [
  { key: "viewed", label: "Tour Viewed", description: "Saw a tour page", icon: Eye, color: chartColors.blue },
  { key: "checkout_started", label: "Checkout Started", description: "Seat held — checkout begun", icon: CreditCard, color: chartColors.violet },
  { key: "booking_completed", label: "Booking Completed", description: "Booking created (paid or pay-later)", icon: CheckCircle, color: chartColors.green },
];

const STEP_LABELS: Record<string, string> = Object.fromEntries(
  STEP_META.map((s) => [s.key, s.label]),
);

const LEGEND = [
  { key: "views", label: "Views", color: chartColors.blue },
  { key: "checkouts", label: "Checkouts", color: chartColors.amber },
  { key: "bookings", label: "Bookings", color: chartColors.green },
];

interface FunnelStep {
  step: string;
  users: number;
  overallPct: number;
  relativePct: number | null;
  dropOff: string | null;
}

interface AbandonedTourRow {
  tourId: string;
  tourTitle: string;
  checkouts: number;
  value: number;
}

interface FunnelResponse {
  period: string;
  funnel: FunnelStep[];
  conversionRates: { viewToCheckout: number; checkoutToBook: number; overall: number };
  dailyTrend: Array<{ day: string; views: number; checkouts: number; bookings: number }>;
  insights: {
    biggestDropOff: { from: string; to: string; users: number; rate: number };
    medianTimeToBookMinutes: number;
    abandoned: { checkouts: number; value: number; byTour: AbandonedTourRow[] };
  };
}

function formatMinutes(m: number): string {
  if (m <= 0) return "";
  if (m < 60) return `${Math.round(m)} min`;
  const hours = m / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function ConversionFunnelPage() {
  const [period, setPeriod] = useState("30d");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "funnel", period],
    queryFn: () => api.get(`/admin/analytics/funnel?period=${period}`).then((r) => r.data),
  });

  const body = (data?.data || data) as FunnelResponse | undefined;
  const funnel = useMemo(() => body?.funnel || [], [body]);
  const rates = body?.conversionRates;
  const insights = body?.insights;
  const dailyTrend = useMemo(() => body?.dailyTrend || [], [body]);
  const viewedUsers = funnel[0]?.users || 0;
  const hasTraffic = viewedUsers > 0;
  const medianMinutes = insights?.medianTimeToBookMinutes || 0;
  const abandoned = insights?.abandoned;
  const leak = insights?.biggestDropOff;
  const leakHasData = (leak?.users || 0) > 0 && funnel.length > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion Funnel"
        subtitle="Tour Viewed → Checkout Started → Booking Completed — where each step loses people"
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

      <PageInsight icon={<Target className="h-4 w-4" />} title={leakHasData ? "Fix the biggest leak first" : "Read the funnel honestly"}>
        {leakHasData ? (
          <>
            <span className="font-semibold text-text-primary">{STEP_LABELS[leak!.from]} → {STEP_LABELS[leak!.to]}</span>{" "}
            loses <span className="font-semibold text-text-primary">{formatNumber(leak!.users)} people ({leak!.rate.toFixed(1)}%)</span>{" "}
            in this window — the single highest-impact step to improve. Every bar counts unique people, not event rows.
            Checkout Started reflects real seat holds and Booking Completed reflects real bookings created, so the numbers are the ground truth.
          </>
        ) : (
          <>
            Each bar counts unique people. Checkout Started reflects every real
            seat hold (CheckoutDraft) and Booking Completed every real booking
            created — there is no cart step on the storefronts, so none is shown.
            The gap between any two steps is where the money leaks: fix the
            biggest one, then re-measure the same period next week.
          </>
        )}
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Overall Conversion"
          value={rates?.overall != null ? `${rates.overall.toFixed(1)}%` : "—"}
          icon={<CheckCircle className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Views that ended in a booking"
        />
        <StatCard
          label="View → Checkout"
          value={rates?.viewToCheckout != null ? `${rates.viewToCheckout.toFixed(1)}%` : "—"}
          icon={<ArrowRight className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Viewers who started checkout"
        />
        <StatCard
          label="Checkout → Booked"
          value={rates?.checkoutToBook != null ? `${rates.checkoutToBook.toFixed(1)}%` : "—"}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Checkouts that became bookings"
        />
        <StatCard
          label="Abandoned Checkout Value"
          value={abandoned ? formatCurrency(abandoned.value) : "—"}
          icon={<DollarSign className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle={abandoned && abandoned.checkouts > 0
            ? `${formatNumber(abandoned.checkouts)} holds expired before payment`
            : "No expired holds in this window"}
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
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : isError ? (
            <SectionError message="Failed to load funnel data" onRetry={() => refetch()} />
          ) : !hasTraffic ? (
            <SectionEmpty message="Not enough traffic in this window yet — the funnel needs at least a few tour views to be meaningful." />
          ) : (
            <div className="space-y-5">
              {funnel.map((step, idx) => {
                const meta = STEP_META[idx];
                const Icon = meta?.icon || CheckCircle;
                const pctOfTop = step.users > 0 ? Math.max((step.users / viewedUsers) * 100, 0.5) : 0;
                const prevUsers = idx > 0 ? (funnel[idx - 1]?.users || 0) : 0;
                const stepRate = idx > 0 && prevUsers > 0 ? (step.users / prevUsers) * 100 : null;
                return (
                  <div key={step.step} className="rounded-lg border border-border/60 p-4 transition-colors hover:border-border/100">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${meta?.color}18` }}>
                        <Icon className="h-5 w-5" style={{ color: meta?.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary">{meta?.label || step.step}</p>
                            <p className="text-xs text-text-tertiary">{meta?.description}</p>
                          </div>
                          <div className="flex items-baseline gap-3">
                            <p className="text-lg font-bold text-text-primary tabular-nums">{formatNumber(step.users)}</p>
                            <p className="text-xs text-text-tertiary tabular-nums">{pctOfTop.toFixed(1)}% of top</p>
                          </div>
                        </div>
                        <div className="mt-2.5 h-2.5 w-full rounded-full bg-surface-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctOfTop}%`, backgroundColor: meta?.color }} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {idx > 0 && stepRate != null && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-active-text">
                              <TrendingUp className="h-3 w-3" />
                              {stepRate.toFixed(1)}% of previous step continued
                            </span>
                          )}
                          {step.dropOff && (
                            <span className="inline-flex items-center gap-1 text-xs text-status-rejected-text">
                              <ArrowDown className="h-3 w-3" />
                              {step.dropOff} dropped from the step before
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Median checkout time lives between Checkout and Booking */}
                    {idx === 1 && medianMinutes > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2 text-xs text-text-tertiary">
                        <Timer className="h-3.5 w-3.5" />
                        Median hold → paid booking: <span className="font-semibold text-text-secondary">{formatMinutes(medianMinutes)}</span> (pay-now checkouts)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <TrendingUp className="h-4 w-4 text-primary" />
              Conversion Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : isError ? (
              <SectionError message="Failed to load daily trend" onRetry={() => refetch()} />
            ) : !dailyTrend.length ? (
              <SectionEmpty message="No daily data for this period yet." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={{ stroke: chartAxis.axis }} tickLine={false} tickFormatter={(v: string) => (v || "").slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: chartAxis.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip formatter={(value) => formatNumber(Number(value))} />} cursor={{ stroke: chartAxis.reference, strokeDasharray: "3 3" }} />
                    {LEGEND.map((item) => (
                      <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} name={item.label} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-6 pt-3">
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

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Abandoned Checkouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : isError ? (
              <SectionError message="Failed to load abandoned checkouts" onRetry={() => refetch()} />
            ) : !abandoned || abandoned.checkouts === 0 ? (
              <SectionEmpty message="No expired holds in this period — every checkout either converted or is still open." />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-status-pending/10 p-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {formatCurrency(abandoned.value)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    frozen in {formatNumber(abandoned.checkouts)} expired hold{abandoned.checkouts === 1 ? "" : "s"} — recovering 1 in 4 is worth{" "}
                    <span className="font-semibold text-text-primary">{formatCurrency(abandoned.value / 4)}</span>.
                  </p>
                </div>
                {abandoned.byTour.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-surface-muted/60 text-left text-xs text-text-tertiary">
                          <th className="px-3 py-2 font-medium">Tour</th>
                          <th className="px-3 py-2 text-right font-medium">Holds</th>
                          <th className="px-3 py-2 text-right font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abandoned.byTour.map((row) => (
                          <tr key={row.tourId} className="border-b border-border/40 last:border-0">
                            <td className="px-3 py-2.5 text-text-primary truncate max-w-[200px]" title={row.tourTitle}>{row.tourTitle}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{formatNumber(row.checkouts)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-medium text-text-primary">{formatCurrency(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">Tour-level breakdown shows once a few expired holds have tour data.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}