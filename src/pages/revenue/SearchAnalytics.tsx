import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import {
  Search,
  Users,
  FileX,
  Percent,
  Eye,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function SearchAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [showAllTop, setShowAllTop] = useState(false);
  const [showAllZero, setShowAllZero] = useState(false);

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "search", period],
    queryFn: async () => {
      const res = await api.get(`/admin/analytics/search?period=${period}`);
      const d = res.data.data;
      return {
        overview: d.overview as { totalSearches: number; uniqueSearchers: number; zeroResultSearches: number; zeroResultRate: number },
        conversion: d.searchOutcome as { searchToViewRate: number; searchToBookRate: number },
        topQueries: (d.topQueries || []).map((q: Record<string, unknown>) => ({
          query: q.query as string,
          searches: q.searches as number,
          uniqueUsers: q.uniqueUsers as number,
          avgResults: q.avgResults as number,
        })),
        zeroResultQueries: (d.zeroResultQueries || []).map((q: Record<string, unknown>) => ({
          query: q.query as string,
          searches: q.searches as number,
        })),
        dailyTrend: (d.dailyTrend || []).map((t: Record<string, unknown>) => ({
          date: t.day as string,
          withResults: t.searchesWithResults as number,
          withoutResults: ((t.searches as number) - (t.searchesWithResults as number)),
        })),
      };
    },
  });

  const overview = raw?.overview;
  const conversion = raw?.conversion;
  const totalSearches = overview?.totalSearches ?? 0;
  const zeroRate = overview?.zeroResultRate ?? 0;

  const topQueryColumns: Column<{ query?: string; searches?: number; uniqueUsers?: number; avgResults?: number }>[] = [
    { key: "query", header: "Query", render: (r) => r.query || "—" },
    { key: "searches", header: "Searches", sortable: true, align: "right", render: (r) => <span className="tabular-nums">{formatNumber(r.searches)}</span> },
    { key: "uniqueUsers", header: "Unique Users", align: "right", render: (r) => <span className="tabular-nums">{formatNumber(r.uniqueUsers)}</span> },
    { key: "avgResults", header: "Avg Results", align: "right", render: (r) => <span className="tabular-nums">{r.avgResults != null ? Number(r.avgResults).toFixed(1) : "—"}</span> },
  ];

  const zeroResultColumns: Column<{ query?: string; searches?: number }>[] = [
    { key: "query", header: "Query", render: (r) => <span className="text-status-flagged font-medium">{r.query}</span> },
    { key: "searches", header: "Searches", align: "right", render: (r) => <span className="tabular-nums">{formatNumber(r.searches)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Analytics"
        subtitle="How customers search for tours, what they find, and where demand goes unanswered"
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

      <PageInsight icon={<Search className="h-4 w-4" />} title="Where demand goes unmet">
        A zero result search is a customer asking for a tour you don't have. That's missed demand, not just a failed query. Read the Zero Result Queries table as a catalog backlog: every repeated query without a match is a tour title or tag you could add to capture sales you're currently losing. Conversion rates show how well search hands off to the rest of the funnel. A strong search to view with a weak search to book means customers find tours but hesitate before committing.
      </PageInsight>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Total Searches"
          value={isLoading ? "..." : formatNumber(totalSearches)}
          icon={<Search className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="All search queries submitted"
        />
        <StatCard
          label="Unique Searchers"
          value={isLoading ? "..." : formatNumber(overview?.uniqueSearchers)}
          icon={<Users className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Distinct users who searched"
        />
        <StatCard
          label="Zero-Result Searches"
          value={isLoading ? "..." : formatNumber(overview?.zeroResultSearches)}
          icon={<FileX className="h-5 w-5" />}
          accent="amber"
          loading={isLoading}
          subtitle="Queries with no matching tour"
        />
        <StatCard
          label="Zero-Result Rate"
          value={isLoading ? "..." : zeroRate != null ? `${zeroRate.toFixed(1)}%` : "—"}
          icon={<Percent className="h-5 w-5" />}
          accent="red"
          loading={isLoading}
          subtitle="Share of searches that come up empty"
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Search-to-View Rate"
          value={isLoading ? "..." : conversion?.searchToViewRate != null ? `${conversion.searchToViewRate.toFixed(1)}%` : "—"}
          icon={<Eye className="h-5 w-5" />}
          accent="emerald"
          loading={isLoading}
          subtitle="Users who opened a tour from results"
        />
        <StatCard
          label="Search-to-Book Rate"
          value={isLoading ? "..." : conversion?.searchToBookRate != null ? `${conversion.searchToBookRate.toFixed(1)}%` : "—"}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="blue"
          loading={isLoading}
          subtitle="Users who searched, then booked"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Search Trend
          </CardTitle>
          <div className="hidden items-center gap-4 text-right sm:flex">
            <div>
              <p className="text-xs text-text-tertiary">Search-to-View</p>
              <p className="font-semibold text-text-primary">{conversion?.searchToViewRate?.toFixed(1) ?? "—"}%</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-text-tertiary">Search-to-Book</p>
              <p className="font-semibold text-text-primary">{conversion?.searchToBookRate?.toFixed(1) ?? "—"}%</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : isError ? (
            <SectionError message="Failed to load daily trend" onRetry={() => refetch()} />
          ) : !raw?.dailyTrend?.length ? (
            <SectionEmpty message="No daily trend data" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={raw.dailyTrend}>
                <defs>
                  <linearGradient id="withResultsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.green} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chartColors.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="withoutResultsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.red} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chartColors.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartAxis.tick }} tickLine={false} axisLine={{ stroke: chartAxis.axis }} />
                <YAxis tick={{ fontSize: 11, fill: chartAxis.tick }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: chartAxis.reference, strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="withResults" fill="url(#withResultsGrad)" stroke={chartColors.green} strokeWidth={2.5} name="With Results" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={800} />
                <Area type="monotone" dataKey="withoutResults" fill="url(#withoutResultsGrad)" stroke={chartColors.red} strokeWidth={2.5} name="Without Results" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={800} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <TrendingUp className="h-4 w-4 text-primary" />
                Top Queries
              </CardTitle>
              {!isLoading && !isError && (raw?.topQueries?.length || 0) > 10 && (
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary" onClick={() => setShowAllTop(!showAllTop)}>
                  {showAllTop ? "Show Less" : `View All (${raw?.topQueries?.length})`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={topQueryColumns}
              data={showAllTop ? (raw?.topQueries || []) : (raw?.topQueries || []).slice(0, 10)}
              loading={isLoading}
              error={isError ? "Failed to load queries" : null}
              emptyMessage="No search query data"
              onRetry={() => refetch()}
              keyExtractor={(r) => r.query || Math.random().toString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <FileX className="h-4 w-4 text-status-pending" />
                Zero-Result Queries
              </CardTitle>
              {!isLoading && !isError && (raw?.zeroResultQueries?.length || 0) > 10 && (
                <Button variant="ghost" size="sm" className="text-xs text-status-pending hover:text-status-pending" onClick={() => setShowAllZero(!showAllZero)}>
                  {showAllZero ? "Show Less" : `View All (${raw?.zeroResultQueries?.length})`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={zeroResultColumns}
              data={showAllZero ? (raw?.zeroResultQueries || []) : (raw?.zeroResultQueries || []).slice(0, 10)}
              loading={isLoading}
              error={isError ? "Failed to load zero-result queries" : null}
              emptyMessage="No zero-result queries found"
              onRetry={() => refetch()}
              keyExtractor={(r) => r.query || Math.random().toString()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
