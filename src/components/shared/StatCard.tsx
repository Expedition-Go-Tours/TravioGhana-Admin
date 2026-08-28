import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn } from "@/lib/animations";
import { Skeleton } from "@/components/ui/skeleton";

type StatAccent = "emerald" | "blue" | "amber" | "red";

const ACCENT_CLASSES: Record<StatAccent, string> = {
  emerald: "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300",
  blue: "bg-status-approved/15 text-status-approved",
  amber: "bg-status-pending/15 text-status-pending",
  red: "bg-status-rejected/15 text-status-rejected",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: StatAccent;
  trend?: { value: number; isPositive: boolean };
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
  subtitle,
  loading,
  onClick,
  className,
}: StatCardProps) {
  return (
    <motion.div
      variants={fadeIn}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      className={cn(
        "rounded-lg border border-border/60 p-5 shadow-soft transition-all duration-300",
        ACCENT_CLASSES[accent],
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-soft-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-3xl font-display font-bold tracking-tight text-text-primary tabular-nums leading-tight">{value}</p>
          )}
          {(trend || subtitle) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {trend && (
                <span className={cn("inline-flex items-center gap-1 text-xs font-medium", trend.isPositive ? "text-status-active" : "text-status-rejected")}>
                  {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
                </span>
              )}
              {subtitle && <span className="text-[11px] text-text-tertiary truncate">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
