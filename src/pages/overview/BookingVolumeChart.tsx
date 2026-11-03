import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import styles from "../Overview.module.css";

const periodLabels: Record<string, string> = {
  today: "Today",
  this_month: "This month",
  last_month: "Last month",
  last_quarter: "Last quarter",
};

const periodTrendLabels: Record<string, string> = {
  today: "vs yesterday",
  this_month: "vs last month",
  last_month: "vs previous month",
  last_quarter: "vs previous quarter",
};

interface BookingVolumeChartProps {
  data?: Array<{ day: string; count: number }>;
  total?: number;
  trend?: { value: number; isPositive: boolean; raw?: number };
  loading?: boolean;
  period?: string;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingVolumeChart({ data, total, trend, loading, period = "this_month" }: BookingVolumeChartProps) {
  const chartData = data || days.map((day) => ({ day, count: 0 }));
  const maxVal = Math.max(...chartData.map((d) => d.count), 0);
  const tickInterval = chartData.length > 10 ? Math.ceil(chartData.length / 6) : 0;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-base p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <h3 className="text-[15px] font-semibold text-text-primary">Booking Volume Trend</h3>
        </div>
        <span className="text-xs text-text-secondary bg-surface-muted px-3 py-1.5 rounded-xl font-medium">{periodLabels[period] || "This month"}</span>
      </div>
      
      {loading ? (
        <Skeleton className="h-6 w-32 mt-2" />
      ) : (
        <div className="flex items-baseline gap-2 mb-6">
          <span className="tnum text-[26px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">{formatNumber(total)}</span>
          {trend && (
            <span
              className={cn("tnum text-sm font-semibold flex items-center gap-1", trend.isPositive ? "text-status-active-text" : "text-status-rejected-text")}
              title={trend.raw && trend.raw > trend.value ? `${trend.raw}% ${periodTrendLabels[period] || "vs previous period"}` : undefined}
            >
              {trend.isPositive ? "+" : ""}{trend.value}%{trend.raw && trend.raw > trend.value ? "+" : ""} {periodTrendLabels[period] || "vs previous period"}
            </span>
          )}
        </div>
      )}
      
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className={cn(styles.chartBar, "min-h-[180px] flex-1 rounded-xl p-2 -mx-2")}>
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--text-tertiary))" }}
                interval={tickInterval}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--text-tertiary))" }}
                tickFormatter={(value) => value.toString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--surface-base))",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
                cursor={{ fill: "hsl(var(--text-primary) / 0.04)" }}
                labelFormatter={(label) => `Bookings · ${label}`}
                formatter={(value) => [formatNumber(Number(value)), "Bookings"]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.count === maxVal && maxVal > 0
                      ? "hsl(var(--primary))"
                      : entry.count > 0
                        ? "hsl(var(--primary) / 0.25)"
                        : "hsl(var(--border) / 0.5)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}