import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import styles from "../Overview.module.css";

const periodLabels: Record<string, string> = {
  today: "Today",
  last_week: "Last 7 days",
  last_month: "Last 30 days",
  last_quarter: "Last 90 days",
};

const periodTrendLabels: Record<string, string> = {
  today: "vs yesterday",
  last_week: "vs previous week",
  last_month: "vs previous month",
  last_quarter: "vs previous quarter",
};

interface BookingVolumeChartProps {
  data?: Array<{ day: string; count: number }>;
  total?: number;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
  period?: string;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingVolumeChart({ data, total, trend, loading, period = "last_week" }: BookingVolumeChartProps) {
  const chartData = data || days.map((day) => ({ day, count: 0 }));
  const maxVal = Math.max(...chartData.map((d) => d.count), 0);

  return (
    <div className="rounded-2xl bg-surface-base border border-emerald-200/40 dark:border-emerald-800/20 shadow-soft p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            <Calendar className="h-4 w-4" />
          </span>
          <h3 className="text-[15px] font-semibold text-text-primary">Booking Volume Trend</h3>
        </div>
        <span className="text-xs text-text-secondary bg-surface-muted px-3 py-1.5 rounded-lg font-medium">{periodLabels[period] || "Last 7 days"}</span>
      </div>
      
      {loading ? (
        <Skeleton className="h-6 w-32 mt-2" />
      ) : (
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-3xl font-bold text-text-primary">{formatNumber(total)}</span>
          {trend && (
            <span className={cn("text-sm font-medium flex items-center gap-1", trend.isPositive ? "text-status-active" : "text-red-500")}>
              {trend.isPositive ? "+" : ""}{trend.value}% {periodTrendLabels[period] || "vs previous week"}
            </span>
          )}
        </div>
      )}
      
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className={cn(styles.chartBar, "rounded-xl bg-gradient-to-b from-emerald-50/40 to-transparent dark:from-emerald-950/15 dark:to-transparent p-2 -mx-2")}>
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--text-tertiary))" }}
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
                cursor={{ fill: "rgba(0,0,0,0.02)" }}
                formatter={(value) => formatNumber(Number(value))}
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
