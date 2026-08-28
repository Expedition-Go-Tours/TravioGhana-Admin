import { cn } from "@/lib/utils";

export interface PayoutStatusTab {
  key: string;
  label: string;
  count?: number;
}

interface PayoutStatusTabsProps {
  tabs: PayoutStatusTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function PayoutStatusTabs({ tabs, active, onChange, className }: PayoutStatusTabsProps) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-border-muted", className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-primary"
            )}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-tertiary"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
