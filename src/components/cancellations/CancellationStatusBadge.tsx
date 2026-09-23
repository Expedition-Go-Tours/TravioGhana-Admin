/* eslint-disable react-refresh/only-export-components */
import { Badge } from "@/components/ui/badge";
import type { CancellationStatus } from "@/services/cancellationService";

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVING: "Approving",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  SUPERSEDED: "Superseded",
};

const VARIANTS: Record<CancellationStatus, "warning" | "success" | "error" | "secondary" | "outline"> = {
  PENDING_APPROVAL: "warning",
  APPROVING: "warning",
  APPROVED: "success",
  REJECTED: "error",
  WITHDRAWN: "secondary",
  SUPERSEDED: "outline",
};

export function cancellationStatusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return CANCELLATION_STATUS_LABELS[status as CancellationStatus] || status.replace(/_/g, " ").toLowerCase();
}

export function CancellationStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const key = (status || "PENDING_APPROVAL") as CancellationStatus;
  return (
    <Badge variant={VARIANTS[key] || "outline"} className={className}>
      {cancellationStatusLabel(status)}
    </Badge>
  );
}
