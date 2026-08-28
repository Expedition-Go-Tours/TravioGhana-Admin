import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-primary to-primary/40 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}