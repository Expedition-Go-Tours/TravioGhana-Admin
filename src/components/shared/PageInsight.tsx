import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageInsightProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function PageInsight({ title, children, icon, className }: PageInsightProps) {
  return (
    <div className={cn("flex gap-3.5 rounded-xl border border-border bg-surface-base p-4", className)}>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon ?? <Lightbulb className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-text-secondary">{children}</div>
      </div>
    </div>
  );
}