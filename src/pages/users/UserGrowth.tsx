import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, Users, UserPlus, Activity } from "lucide-react";
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

const periods = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

function formatMonth(v: unknown) {
  if (typeof v !== "string") return String(v ?? "");
  const d = new Date(v + "-02");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function UserGrowthPage() {
  const [period, setPeriod] = useState("1y");
  const [dialog, setDialog] = useState<{ type: "all" | "customer" | "supplier" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "user-growth", period],
    queryFn: () => api.get(`/admin/analytics/user-growth?period=${period}`).then((r) => r.data),
  });

  const { data: dialogUsers, isLoading: dialogLoading } = useQuery({
    queryKey: ["admin", "users", "new", period, dialog?.type],
    queryFn: async () => {
      const role = dialog?.type === "all" ? undefined : dialog?.type;
      const res = await api.get(`/admin/users/new?period=${period}${role ? `&role=${role}` : ""}`);
      return (res.data?.data?.users || []) as Array<{ id: string; name: string; email: string; photoURL?: string; roles?: string[]; createdAt?: string }>;
    },
    enabled: !!dialog,
  });

  const growth = useMemo(() => data?.data?.growth || [], [data]);

  const { totals, latestMonth, avgMonthly, momChange, customerMom, supplierMom } = useMemo(() => {
    if (!growth.length) return { totals: { customers: 0, suppliers: 0, total: 0 }, latestMonth: null, avgMonthly: 0, momChange: null, customerMom: null, supplierMom: null };

    const totals = growth.reduce(
      (acc: { customers: number; suppliers: number; total: number }, curr: { customers?: number; suppliers?: number; total?: number }) => ({
        customers: acc.customers + (curr.customers || 0),
        suppliers: acc.suppliers + (curr.suppliers || 0),
        total: acc.total + (curr.total || 0),
      }),
      { customers: 0, suppliers: 0, total: 0 },
    );

    const lm = growth[growth.length - 1];
    const prev = growth.length > 1 ? growth[growth.length - 2] : null;
    const cap = (v: number | null) => v != null ? Math.sign(v) * Math.min(Math.abs(v), 100) : null;
    const mom = cap(prev && prev.total > 0 ? ((lm.total - prev.total) / prev.total) * 100 : null);
    const custMom = cap(prev && prev.customers > 0 ? ((lm.customers - prev.customers) / prev.customers) * 100 : null);
    const suppMom = cap(prev && prev.suppliers > 0 ? ((lm.suppliers - prev.suppliers) / prev.suppliers) * 100 : null);

    return { totals, latestMonth: lm, avgMonthly: Math.round(totals.total / growth.length), momChange: mom, customerMom: custMom, supplierMom: suppMom };
  }, [growth]);

  const makeTrend = (v: number | null) => (v != null ? { value: v, isPositive: v >= 0 } : undefined);

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
        Customers grow demand for tours; suppliers grow the supply of them. A healthy marketplace adds both. The trend chips show the month over month change in the latest period, and the bar chart splits registrations by role. Click any card to drill into exactly who signed up. If customer growth outpaces supplier growth for months on end, you risk running thin on inventory at peak season.
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
          trend={makeTrend(momChange)}
          subtitle={latestMonth ? `${formatNumber(latestMonth.total)} this month` : undefined}
          onClick={() => setDialog({ type: "all" })}
        />
        <StatCard
          label="New Customers"
          value={isLoading ? "..." : formatNumber(totals.customers)}
          icon={<UserPlus className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          trend={makeTrend(customerMom)}
          subtitle={latestMonth ? `${formatNumber(latestMonth.customers)} this month` : undefined}
          onClick={() => setDialog({ type: "customer" })}
        />
        <StatCard
          label="New Suppliers"
          value={isLoading ? "..." : formatNumber(totals.suppliers)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          trend={makeTrend(supplierMom)}
          subtitle={latestMonth ? `${formatNumber(latestMonth.suppliers)} this month` : undefined}
          onClick={() => setDialog({ type: "supplier" })}
        />
        <StatCard
          label="Avg / Month"
          value={isLoading ? "..." : formatNumber(avgMonthly)}
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle={growth.length ? `over ${growth.length} months` : undefined}
        />
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingUp className="h-4 w-4 text-primary" />
            Monthly Registrations
          </CardTitle>
          {totals.total > 0 && (
            <span className="text-xs text-text-tertiary">Total: {formatNumber(totals.total)} users</span>
          )}
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
                <BarChart data={growth} barGap={2} barCategoryGap="16%">
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
                    tickFormatter={formatMonth}
                    tick={{ fontSize: 12, fill: chartAxis.tick }}
                    axisLine={{ stroke: chartAxis.axis }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12, fill: chartAxis.tick }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(value) => formatNumber(Number(value))} />} cursor={{ fill: "hsl(var(--surface-muted) / 0.4)" }} labelFormatter={formatMonth} />
                  <ReferenceLine y={0} stroke={chartAxis.reference} />
                  <Bar dataKey="customers" fill="url(#uc)" name="Customers" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="suppliers" fill="url(#us)" name="Suppliers" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.blue }} />
                  Customers
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.amber }} />
                  Suppliers
                </div>
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
            </DialogTitle>
            <DialogDescription>
              {dialogUsers?.length || 0} users registered in the selected period
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