import type { ReactNode } from "react";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import OptimizedImage from "./OptimizedImage";

interface CellAvatarProps {
  src?: string | null;
  alt?: string;
  initials: string;
  size?: "sm" | "md";
  className?: string;
}

export function CellAvatar({ src, alt = "", initials, size = "md", className }: CellAvatarProps) {
  const box = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent font-bold text-accent-foreground", box, className)}>
      {src ? (
        <OptimizedImage src={src} alt={alt} width={36} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <span className={src ? "opacity-0" : ""}>{initials || "?"}</span>
    </div>
  );
}

interface CellTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export function CellTitle({ title, subtitle, className }: CellTitleProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-sm font-medium text-text-primary">{title}</p>
      {subtitle != null && <p className="truncate text-xs text-text-tertiary">{subtitle}</p>}
    </div>
  );
}

interface CellThumbProps {
  src?: string | null;
  alt?: string;
  fallbackIcon?: ReactNode;
  className?: string;
}

export function CellThumb({ src, alt = "", fallbackIcon, className }: CellThumbProps) {
  return (
    <div className={cn("h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted", className)}>
      {src ? (
        <OptimizedImage src={src} alt={alt} width={32} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-tertiary">{fallbackIcon}</div>
      )}
    </div>
  );
}

interface MoneyCellProps {
  value: number | string | null | undefined;
  currency?: string | null;
  className?: string;
  faint?: boolean;
}

export function MoneyCell({ value, currency, className, faint }: MoneyCellProps) {
  return (
    <span className={cn(
      "whitespace-nowrap tabular-nums",
      faint ? "text-sm text-text-secondary" : "text-sm font-semibold text-text-primary",
      className,
    )}>
      {formatCurrency(value, currency)}
    </span>
  );
}

interface DateCellProps {
  value: string | null | undefined;
  withTime?: boolean;
  className?: string;
}

export function DateCell({ value, withTime, className }: DateCellProps) {
  if (!value) return <span className={cn("text-xs text-text-tertiary", className)}>—</span>;
  return (
    <span className={cn("whitespace-nowrap text-xs text-text-tertiary", className)}>
      {withTime ? formatDateTime(value) : formatDate(value)}
    </span>
  );
}

export function StatusCell({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}