import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  pending: { dot: "bg-status-pending", bg: "bg-status-pending/10 text-status-pending", label: "Pending" },
  active: { dot: "bg-status-active", bg: "bg-status-active/10 text-status-active", label: "Active" },
  approved: { dot: "bg-status-approved", bg: "bg-status-approved/10 text-status-approved", label: "Approved" },
  rejected: { dot: "bg-status-rejected", bg: "bg-status-rejected/10 text-status-rejected", label: "Rejected" },
  suspended: { dot: "bg-status-suspended", bg: "bg-status-suspended/10 text-status-suspended", label: "Suspended" },
  flagged: { dot: "bg-status-flagged", bg: "bg-status-flagged/10 text-status-flagged", label: "Flagged" },
  processing: { dot: "bg-status-processing", bg: "bg-status-processing/10 text-status-processing", label: "Processing" },
  paid: { dot: "bg-status-active", bg: "bg-status-active/10 text-status-active", label: "Paid" },
  confirmed: { dot: "bg-status-approved", bg: "bg-status-approved/10 text-status-approved", label: "Confirmed" },
  completed: { dot: "bg-status-active", bg: "bg-status-active/10 text-status-active", label: "Completed" },
  cancelled: { dot: "bg-status-rejected", bg: "bg-status-rejected/10 text-status-rejected", label: "Cancelled" },
  failed: { dot: "bg-status-rejected", bg: "bg-status-rejected/10 text-status-rejected", label: "Failed" },
  draft: { dot: "bg-text-tertiary/50", bg: "bg-surface-muted text-text-secondary", label: "Draft" },
  published: { dot: "bg-status-active", bg: "bg-status-active/10 text-status-active", label: "Published" },
  archived: { dot: "bg-text-tertiary/50", bg: "bg-surface-muted text-text-secondary", label: "Archived" },
  verified: { dot: "bg-status-approved", bg: "bg-status-approved/10 text-status-approved", label: "Verified" },
  no_show: { dot: "bg-status-rejected", bg: "bg-status-rejected/10 text-status-rejected", label: "No Show" },
  refunded: { dot: "bg-status-pending", bg: "bg-status-pending/10 text-status-pending", label: "Refunded" },
  partially_refunded: { dot: "bg-status-pending", bg: "bg-status-pending/10 text-status-pending", label: "Partial Refund" },
  succeeded: { dot: "bg-status-active", bg: "bg-status-active/10 text-status-active", label: "Succeeded" },
};

type StatusKey = keyof typeof STATUS_STYLES;

interface StatusChipProps {
  status: string;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") as StatusKey;
  const style = STATUS_STYLES[key] || { dot: "bg-text-tertiary/50", bg: "bg-surface-muted text-text-secondary", label: status || "Unknown" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg min-w-[68px] justify-center",
        style.bg,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {style.label}
    </span>
  );
}