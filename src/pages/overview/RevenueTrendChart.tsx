import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface RevenueTrendChartProps {
  data?: Array<{ month: string; revenue: number; commission: number; supplierPayout: number }>;
  loading?: boolean;
}

export function RevenueTrendChart({ data, loading }: RevenueTrendChartProps) {
  const chartData = data || [];

  return (
    <div className="rounded-2xl bg-surface-base border border-border/60 shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-text-secondary" />
          <h3 className="text-[15px] font-semibold text-text-primary">Revenue Trend</h3>
        </div>
        <span className="text-xs text-text-secondary bg-surface-muted px-3 py-1.5 rounded-lg font-medium">24 months</span>
      </div>
      
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--status-active))" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="hsl(var(--status-active))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "hsl(var(--text-tertiary))" }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "hsl(var(--text-tertiary))" }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-base))",
                border: "none",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--status-active))" 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
              name="Revenue"
            />
            <Area 
              type="monotone" 
              dataKey="commission" 
              stroke="hsl(var(--chart-5))" 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorCommission)" 
              name="Commission"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      
      {!loading && chartData.length > 0 && (
        <div className="mt-4 flex justify-center gap-6">
          <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-status-active" />
            Revenue
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            Commission
          </span>
        </div>
      )}
    </div>
  );
}
