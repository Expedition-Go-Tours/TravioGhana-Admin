import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, Users, UserPlus, Activity, Download, Info, Phone } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { StatCard } from "@/components/shared/StatCard";
import { chartColors, chartAxis } from "@/components/shared/chartTheme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/axios";
import { staggerContainer } from "@/lib/animations";
import { formatNumber, formatDate } from "@/lib/utils";
import OptimizedImage from "@/components/shared/OptimizedImage";
import {
  formatAxisLabel,
  formatTooltipLabel,
  buildGrowthCsv,
  type Granularity,
  type GrowthRow,
} from "./userGrowthFormat";

const periods = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

const PERIOD_WINDOW_LABEL: Record<string, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "1y": "12 months",
  "24m": "24 months",
};

const BUCKET_NOUN: Record<Granularity, string> = { day: "Day", week: "Week", month: "Month" };

interface GrowthResponse {
  growth: GrowthRow[];
  previous: GrowthRow[];
  granularity: Granularity;
  period: string;
}

interface DialogUser {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  roles?: string[];
  createdAt?: string;
  phone?: string | null;
  hasBookings?: boolean;
}

type DialogState = { type: "all" | "customer" | "supplier"; bucket?: string } | null;

/**
 * Parse a backend bucket label ("2026-10" or "2026-10-05") into a local date.
 * Timezone-stable — never round-trips through ISO strings, so it is immune to
 * the "Invalid Date" bug that hit month labels ending in "Z".
 */
interface GrowthTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: unknown;
  granularity: Granularity;
  compare: boolean;
}

function GrowthTooltip({ active, payload, label, granularity, compare }: GrowthTooltipProps) {
  if (!active || !payload?.length) return null;
  const customers = payload.find((p) => p.dataKey === "customers")?.value ?? 0;
  const suppliers = payload.find((p) => p.dataKey === "suppliers")?.value ?? 0;
  const prev = payload.find((p) => p.dataKey === "prevTotal")?.value;

  const rows = [
    { color: chartColors.blue, name: "Customers", display: formatNumber(customers) },
    { color: chartColors.amber, name: "Suppliers", display: formatNumber(suppliers) },
    { color: chartColors.green, name: "Total", display: formatNumber(customers + suppliers) },
  ];

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-surface-base p-3 shadow-soft-lg">
      <p className="mb-2 text-xs font-medium text-text-tertiary">{formatTooltipLabel(label, granularity)}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
            <span className="text-text-secondary">{row.name}:</span>
            <span className="font-semibold text-text-primary tabular-nums">{row.display}</span>
          </div>
        ))}
        {compare && prev != null && (
          <div className="mt-1.5 border-t border-border pt-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-0 w-3 shrink-0 border-t border-dashed border-text-tertiary" />
              <span className="text-text-secondary">Previous total:</span>
              <span className="font-semibold text-text-primary tabular-nums">{formatNumber(prev)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserGrowthPage() {
  const [period, setPeriod] = useState("1y");
  const [compare, setCompare] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "user-growth", period],
    queryFn: () => api.get(`/admin/analytics/user-growth?period=${period}`).then((r) => r.data),
  });

  const responseData = data?.data as GrowthResponse | undefined;
  const growth = useMemo(() => responseData?.growth ?? [], [responseData]);
  const previous = useMemo(() => responseData?.previous ?? [], [responseData]);
  const granularity = responseData?.granularity ?? "month";

  const { data: dialogUsers, isLoading: dialogLoading } = useQuery({
    queryKey: ["admin", "users", "new", period, dialog?.type, dialog?.bucket],
    queryFn: async () => {
      const role = dialog?.type === "all" ? undefined : dialog?.type;
      const params = new URLSearchParams({ period });
      if (role) params.set("role", role);
      if (dialog?.bucket) {
        params.set("bucket", dialog.bucket);
        params.set("granularity", granularity);
      }
      const res = await api.get(`/admin/users/new?${params.toString()}`);
      return (res.data?.data?.users || []) as DialogUser[];
    },
    enabled: !!dialog,
  });

  const { totals, deltas, latest, avg, series } = useMemo(() => {
    const sum = (rows: GrowthRow[]) =>
      rows.reduce(
        (acc, r) => ({
          customers: acc.customers + (r.customers || 0),
          suppliers: acc.suppliers + (r.suppliers || 0),
          total: acc.total + (r.total || 0),
        }),
        { customers: 0, suppliers: 0, total: 0 },
      );
    const totals = sum(growth);
    const prevTotals = sum(previous);
    const cap = (v: number | null) => (v != null ? Math.sign(v) * Math.min(Math.abs(v), 100) : null);
    const delta = (cur: number, prev: number) => cap(prev > 0 ? ((cur - prev) / prev) * 100 : null);
    const latest = growth[growth.length - 1] ?? null;
    return {
      totals,
      deltas: {
        total: delta(totals.total, prevTotals.total),
        customers: delta(totals.customers, prevTotals.customers),
        suppliers: delta(totals.suppliers, prevTotals.suppliers),
      },
      latest,
      avg: growth.length ? Math.round(totals.total / growth.length) : 0,
      series: {
        total: growth.map((r) => r.total || 0),
        customers: growth.map((r) => r.customers || 0),
        suppliers: growth.map((r) => r.suppliers || 0),
      },
    };
  }, [growth, previous]);

  const chartData = useMemo(
    () => growth.map((r, i) => ({ ...r, prevTotal: previous[i]?.total ?? null })),
    [growth, previous],
  );

  const makeTrend = (v: number | null) => (v != null ? { value: v, isPositive: v >= 0 } : undefined);
  const windowNote = `vs prev. ${PERIOD_WINDOW_LABEL[period]}`;
  const bucketNoun = BUCKET_NOUN[granularity];
  const bucketLabel = (value: number | undefined) =>
    latest ? `${formatNumber(value ?? 0)} in ${formatTooltipLabel(latest.month, granularity)}` : undefined;

  const openDialog = useCallback((type: "all" | "customer" | "supplier", bucket?: string) => {
    setDialog({ type, bucket });
  }, []);

  const handleExportCsv = () => {
    if (!growth.length) return;
    const csv = buildGrowthCsv(growth);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-growth-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const drillFromBar = (entry: { payload?: { month?: string } } | null) => {
    if (entry?.payload?.month) openDialog("all", entry.payload.month);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Growth"
        subtitle="Who's joining the marketplace, customers and suppliers, and how fast"
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

      <PageInsight icon={<Users className="h-4 w-4" />} title="Supply and demand in one view">
        Customers grow demand for tours; suppliers grow the supply of them. A healthy marketplace adds both. Cards compare the selected period against the previous one, the trend chart stacks registrations by role (click any bar to see exactly who signed up), and the "Previous period" toggle overlays the equal window before it for context. The latest bucket is still in progress, so its numbers are partial.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Total New Users"
          value={isLoading ? "..." : formatNumber(totals.total)}
          icon={<Users className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          trend={makeTrend(deltas.total)}
          trendNote={deltas.total != null ? windowNote : undefined}
          sparkline={{ data: series.total, color: chartColors.green }}
          subtitle={bucketLabel(latest?.total)}
          onClick={() => openDialog("all")}
        />
        <StatCard
          label="New Customers"
          value={isLoading ? "..." : formatNumber(totals.customers)}
          icon={<UserPlus className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          trend={makeTrend(deltas.customers)}
          trendNote={deltas.customers != null ? windowNote : undefined}
          sparkline={{ data: series.customers, color: chartColors.blue }}
          subtitle={bucketLabel(latest?.customers)}
          onClick={() => openDialog("customer")}
        />
        <StatCard
          label="New Suppliers"
          value={isLoading ? "..." : formatNumber(totals.suppliers)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          trend={makeTrend(deltas.suppliers)}
          trendNote={deltas.suppliers != null ? windowNote : undefined}
          sparkline={{ data: series.suppliers, color: chartColors.amber }}
          subtitle={bucketLabel(latest?.suppliers)}
          onClick={() => openDialog("supplier")}
        />
        <StatCard
          label={`Avg / ${bucketNoun}`}
          value={isLoading ? "..." : formatNumber(avg)}
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          sparkline={{ data: series.total, color: chartColors.violet }}
          subtitle={growth.length ? `over ${growth.length} ${bucketNoun.toLowerCase()}s` : undefined}
        />
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <TrendingUp className="h-4 w-4 text-primary" />
              Registration Trend
              <span
                className="cursor-help text-text-tertiary"
                title="Accounts created in the marketplace, split by role. Total = customers + suppliers. The latest bucket may still be in progress. Click a bar to see who signed up."
              >
                <Info className="h-3.5 w-3.5" aria-label="About these metrics" role="img" />
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-text-tertiary">
              Stacked by role · click a bar to drill into who signed up
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {totals.total > 0 && (
              <span className="hidden text-xs text-text-tertiary sm:inline">
                Total: {formatNumber(totals.total)} · last {PERIOD_WINDOW_LABEL[period]}
              </span>
            )}
            <Button
              size="sm"
              variant={compare ? "default" : "outline"}
              onClick={() => setCompare((c) => !c)}
              disabled={!previous.length}
              aria-pressed={compare}
              title={previous.length ? "Overlay the equal window before this period" : "No data for the previous period yet"}
            >
              Previous period
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!growth.length}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : isError ? (
            <SectionError message="Failed to load user growth data" onRetry={() => refetch()} />
          ) : !growth.length ? (
            <SectionEmpty message="No user growth data for this period" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData} barCategoryGap="18%">
                  <defs>
                    <linearGradient id="uc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.blue} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartColors.blue} stopOpacity={0.25} />
                    </linearGradient>
                    <linearGradient id="us" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.amber} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartColors.amber} stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => formatAxisLabel(v, granularity)}
                    tick={{ fontSize: 12, fill: chartAxis.tick }}
                    axisLine={{ stroke: chartAxis.axis }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: chartAxis.tick }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<GrowthTooltip granularity={granularity} compare={compare} />}
                    cursor={{ fill: "hsl(var(--surface-muted) / 0.4)" }}
                  />
                  <ReferenceLine y={0} stroke={chartAxis.reference} />
                  {compare && (
                    <Line
                      type="monotone"
                      dataKey="prevTotal"
                      name="Previous total"
                      stroke={chartAxis.tick}
                      strokeWidth={1.75}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  )}
                  <Bar
                    dataKey="customers"
                    fill="url(#uc)"
                    name="Customers"
                    stackId="growth"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={44}
                    onClick={(entry) => drillFromBar(entry as { payload?: { month?: string } })}
                    style={{ cursor: "pointer" }}
                  />
                  <Bar
                    dataKey="suppliers"
                    fill="url(#us)"
                    name="Suppliers"
                    stackId="growth"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    onClick={(entry) => drillFromBar(entry as { payload?: { month?: string } })}
                    style={{ cursor: "pointer" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-6 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.blue }} />
                  Customers
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.amber }} />
                  Suppliers
                </div>
                {compare && (
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className="w-3 border-t border-dashed" style={{ borderColor: chartAxis.tick }} />
                    Previous period
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "all" ? "New Users" : dialog?.type === "customer" ? "New Customers" : "New Suppliers"}
              {dialog?.bucket ? ` · ${formatTooltipLabel(dialog.bucket, granularity)}` : ""}
            </DialogTitle>
            <DialogDescription>
              {dialogUsers?.length || 0} users registered{" "}
              {dialog?.bucket ? `in ${formatTooltipLabel(dialog.bucket, granularity)}` : "in the selected period"}
              {!dialog?.bucket && `${dialog?.type ? ` (${dialog.type === "customer" ? "customers" : "suppliers"})` : " (all)"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto">
            {dialogLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !dialogUsers?.length ? (
              <div className="py-10 text-center text-sm text-text-tertiary">No users found for this period</div>
            ) : (
              <div className="divide-y divide-border">
                {dialogUsers.map((u) => (
                  <div key={u.id} className="flex items-start gap-3 py-3.5 first:pt-0">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white">
                      <span>{(u.name || u.email || "?").charAt(0).toUpperCase()}</span>
                      {u.photoURL && (
                        <OptimizedImage
                          src={u.photoURL}
                          alt={u.name || ""}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-cover"
                          width={40}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{u.name || "Unknown"}</p>
                      <p className="text-xs text-text-tertiary truncate">{u.email || "—"}</p>
                      {u.hasBookings && u.phone && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                          <Phone className="h-3 w-3 shrink-0 text-text-tertiary" />
                          <span className="truncate">{u.phone}</span>
                        </p>
                      )}
                      {u.roles && u.roles.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-[10px] capitalize">{role.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {u.createdAt && (
                      <span className="shrink-0 text-xs text-text-tertiary whitespace-nowrap pt-0.5">{formatDate(u.createdAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}