import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined, currency?: string | null): string {
  if (value == null) return "$0.00";
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0.00";
  const code = currency && currency.trim() ? currency.trim().toUpperCase() : null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code || "USD",
    }).format(num);
  } catch {
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeString;
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value == null) return "0";
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("en-US");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const now = new Date();
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export function truncateId(id: string, chars = 12): string {
  return id.length > chars ? id.slice(0, chars) + "..." : id;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: "bg-status-pending/10 text-status-pending border-status-pending/30",
    PENDING_APPROVAL: "bg-status-pending/10 text-status-pending border-status-pending/30",
    APPROVED: "bg-status-approved/10 text-status-approved border-status-approved/30",
    ACTIVE: "bg-status-active/10 text-status-active border-status-active/30",
    REJECTED: "bg-status-rejected/10 text-status-rejected border-status-rejected/30",
    SUSPENDED: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
    FLAGGED: "bg-status-flagged/10 text-status-flagged border-status-flagged/30",
    PROCESSING: "bg-status-processing/10 text-status-processing border-status-processing/30",
    UNDER_REVIEW: "bg-status-approved/10 text-status-approved border-status-approved/30",
    CONFIRMED: "bg-status-active/10 text-status-active border-status-active/30",
    CANCELLED: "bg-status-rejected/10 text-status-rejected border-status-rejected/30",
    REFUNDED: "bg-status-flagged/10 text-status-flagged border-status-flagged/30",
    COMPLETED: "bg-status-approved/10 text-status-approved border-status-approved/30",
    NO_SHOW: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
    PAID: "bg-status-active/10 text-status-active border-status-active/30",
    SUCCEEDED: "bg-status-active/10 text-status-active border-status-active/30",
    PARTIALLY_REFUNDED: "bg-status-flagged/10 text-status-flagged border-status-flagged/30",
    FAILED: "bg-status-rejected/10 text-status-rejected border-status-rejected/30",
    DRAFT: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
    ARCHIVED: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
    PAUSED: "bg-status-flagged/10 text-status-flagged border-status-flagged/30",
    EXPIRED: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
    VERIFIED: "bg-status-active/10 text-status-active border-status-active/30",
    REPLACEMENT_REQUESTED: "bg-status-pending/10 text-status-pending border-status-pending/30",
    OPEN: "bg-status-pending/10 text-status-pending border-status-pending/30",
    RESOLVED_CUSTOMER: "bg-status-flagged/10 text-status-flagged border-status-flagged/30",
    RESOLVED_SUPPLIER: "bg-status-approved/10 text-status-approved border-status-approved/30",
    WITHDRAWN: "bg-status-suspended/10 text-status-suspended border-status-suspended/30",
  };
  return map[status] || "bg-surface-muted text-text-secondary border-border/60";
}

/** Human label for a supplier type enum value. */
export function supplierTypeLabel(type?: string | null): string {
  const map: Record<string, string> = {
    TOUR_GUIDE: "Tour Guide",
    TOUR_COMPANY: "Tour Company",
    ACCOMMODATION_PROVIDER: "Accommodation Provider",
    TRANSPORTATION_PROVIDER: "Transportation Provider",
    VEHICLE_OPERATOR: "Vehicle / Shuttle Operator",
    OTHER_SERVICE_PROVIDER: "Other Service Provider",
  };
  return (type && map[type]) || type || "—";
}

/** Human label for a document type enum value. */
export function documentTypeLabel(type?: string | null): string {
  return (type || "Other").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
