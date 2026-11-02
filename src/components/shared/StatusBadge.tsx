import { cn, getStatusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "tnum inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        getStatusColor(status),
        className,
      )}
    >
      {label || status.replace(/_/g, " ")}
    </span>
  );
}