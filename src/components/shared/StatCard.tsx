import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SparklineChart } from "./SparklineChart";

type StatAccent = "emerald" | "blue" | "amber" | "red";

const ACCENT_CLASSES: Record<StatAccent, string> = {
  emerald: "bg-primary/10 text-primary",
  blue: "bg-status-approved/10 text-status-approved-text",
  amber: "bg-status-pending/10 text-status-pending-text",
  red: "bg-status-rejected/10 text-status-rejected-text",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: StatAccent;
  trend?: { value: number; isPositive: boolean };
  /** Context for the trend chip — e.g. "vs prev. 30 days". */
  trendNote?: string;
  /** Lightweight history strip under the card content. */
  sparkline?: { data?: number[]; color?: string };
  subtitle?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accent = "emerald",
  trend,
  trendNote,
  sparkline,
  subtitle,
  loading,
  onClick,
  className,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      className={cn(
        "rounded-xl border border-border bg-surface-base p-4 sm:p-5",
        onClick && "cursor-pointer transition-colors hover:border-border-muted",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[13px] font-medium leading-snug text-text-tertiary">{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACCENT_CLASSES[accent])}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="tnum whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[24px] lg:text-[26px]">
            {value}
          </p>
        )}
        {(trend || subtitle) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {trend && (
              <span className={cn("tnum inline-flex items-center gap-1 text-xs font-semibold", trend.isPositive ? "text-status-active-text" : "text-status-rejected-text")}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
              </span>
            )}
            {trendNote && <span className="text-[11px] text-text-tertiary">{trendNote}</span>}
            {subtitle && <span className="text-[11px] leading-snug text-text-tertiary">{subtitle}</span>}
          </div>
        )}
      </div>
      {sparkline?.data?.length ? (
        <div className="mt-3 -mx-1">
          <SparklineChart data={sparkline.data} color={sparkline.color} height={36} />
        </div>
      ) : null}
    </div>
  );
}