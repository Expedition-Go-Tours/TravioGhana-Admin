/**
 * Single source of truth for how an admin notification is presented and where
 * it links to.
 *
 * This used to be defined twice — `notificationRouteMap` lived in both
 * NotificationBell and NotificationsCard — and the two copies had already
 * drifted: the overview card was missing eight deep links (refund claims,
 * payment states, supplier cancellations), so those rows dead-ended. Anything
 * that renders notifications should import from here rather than redeclaring
 * the maps.
 *
 * Type → category membership and type → priority are kept in sync with the
 * `AdminNotificationType` enum in Expedition-Go-Backend-v2/prisma/schema.prisma.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  ClipboardCheck,
  CreditCard,
  FileWarning,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Star,
  UserCheck,
  UserPlus,
  UserX,
  XCircle,
} from "lucide-react";

export type NotificationRoute = { path: string; state?: Record<string, unknown> };

export type NotificationRouteMap = Record<
  string,
  (data?: Record<string, unknown>) => NotificationRoute | null
>;

/**
 * Where each notification type deep-links to.
 *
 * Keys are app-relative (`/admin/...`) so they resolve inside whichever admin
 * bundle renders them — the axios interceptor brands the follow-up request.
 */
export const notificationRouteMap: NotificationRouteMap = {
  NEW_SUPPLIER_APPLICATION: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : null,
  SUPPLIER_STATUS_CHANGE: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : null,
  REVIEW_NEEDS_MODERATION: (data) => data?.reviewId ? { path: "/admin/reviews", state: { reviewId: data.reviewId } } : null,
  TOUR_SUBMITTED_FOR_REVIEW: (data) => data?.tourId ? { path: "/admin/tour-moderation", state: { tourId: data.tourId } } : null,
  PAYOUT_NEEDS_APPROVAL: (data) => ({ path: "/admin/payouts", state: { payoutId: data?.payoutId || data?.payoutRequestId } }),
  BOOKING_CREATED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  BOOKING_CONFIRMED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  BOOKING_MODIFIED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  DOCUMENT_EXPIRING: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin/suppliers" },
  DOCUMENT_EXPIRED: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin/suppliers" },
  REFUND_REQUEST: (data) => data?.disputeId ? { path: "/admin/payouts?tab=disputes", state: { disputeId: data.disputeId } } : { path: "/admin/payouts?tab=disputes" },
  REFUND_CLAIM: (data) => data?.claimId ? { path: `/admin/payouts?tab=claims&claimId=${data.claimId}` } : { path: "/admin/payouts?tab=claims" },
  PAYMENT_UPCOMING: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  PAYMENT_COLLECTED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  PAYMENT_COLLECTION_FAILED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  STRIPE_CUSTOMER_CREATE_FAILED: () => ({ path: "/admin/settings" }),
  REFUND_NEEDS_ATTENTION: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/payouts?tab=disputes" },
  SUPPLIER_CANCELLATION_REQUEST: (data) => data?.requestId ? { path: `/cancellations?request=${data.requestId}` } : { path: "/cancellations" },
  SUPPLIER_CANCELLATION_DECIDED: (data) => data?.requestId ? { path: `/cancellations?request=${data.requestId}` } : { path: "/cancellations" },
  SYSTEM_ALERT: (data) => data?.payoutMethodId ? { path: "/admin/payouts?tab=methods", state: { viewSupplierId: data.supplierId } } : data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin" },
  NEW_MESSAGE: (data) => {
    if (!data?.conversationId) return null;
    if (data.conversationType === "SUPPLIER_CUSTOMER") return { path: "/admin/chat/customers" };
    return { path: `/admin/chat/${data.chatType || "suppliers"}`, state: { conversationId: data.conversationId } };
  },
};

/** Resolve a notification's deep link, or `null` when it has nowhere to go. */
export function resolveNotificationRoute(
  type: string,
  data?: Record<string, unknown>,
): NotificationRoute | null {
  return notificationRouteMap[type]?.(data) ?? null;
}

/** True when clicking this notification would actually navigate somewhere. */
export function hasNotificationRoute(type: string, data?: Record<string, unknown>): boolean {
  return resolveNotificationRoute(type, data) !== null;
}

// ── Type presentation ──────────────────────────────────────────────────────

type TypeStyle = { icon: LucideIcon; color: string };

const notificationTypeConfig: Record<string, TypeStyle> = {
  BOOKING_CONFIRMED: { icon: ShoppingCart, color: "text-green-600 dark:text-green-400" },
  BOOKING_MODIFIED: { icon: ShoppingCart, color: "text-indigo-600 dark:text-indigo-400" },
  BOOKING_CANCELLED: { icon: XCircle, color: "text-red-500 dark:text-red-400" },
  BOOKING_CREATED: { icon: ShoppingCart, color: "text-blue-600 dark:text-blue-400" },
  PAYMENT_RECEIVED: { icon: CreditCard, color: "text-green-600 dark:text-green-400" },
  PAYMENT_UPCOMING: { icon: CreditCard, color: "text-amber-600 dark:text-amber-400" },
  PAYMENT_COLLECTED: { icon: CreditCard, color: "text-green-600 dark:text-green-400" },
  PAYMENT_COLLECTION_FAILED: { icon: XCircle, color: "text-red-500 dark:text-red-400" },
  PAYOUT_NEEDS_APPROVAL: { icon: Banknote, color: "text-amber-600 dark:text-amber-400" },
  PAYOUT_COMPLETED: { icon: Banknote, color: "text-green-600 dark:text-green-400" },
  PAYOUT_REQUEST_SUBMITTED: { icon: Banknote, color: "text-amber-600 dark:text-amber-400" },
  PAYOUT_REQUEST_APPROVED: { icon: Banknote, color: "text-green-600 dark:text-green-400" },
  PAYOUT_REQUEST_REJECTED: { icon: Banknote, color: "text-red-500 dark:text-red-400" },
  REVIEW_RECEIVED: { icon: Star, color: "text-amber-600 dark:text-amber-400" },
  SUPPLIER_APPROVED: { icon: UserCheck, color: "text-green-600 dark:text-green-400" },
  SUPPLIER_REJECTED: { icon: UserX, color: "text-red-500 dark:text-red-400" },
  NEW_SUPPLIER_APPLICATION: { icon: UserCheck, color: "text-amber-600 dark:text-amber-400" },
  SUPPLIER_STATUS_CHANGE: { icon: UserCheck, color: "text-blue-600 dark:text-blue-400" },
  REVIEW_NEEDS_MODERATION: { icon: MessageSquare, color: "text-amber-600 dark:text-amber-400" },
  TOUR_SUBMITTED_FOR_REVIEW: { icon: ClipboardCheck, color: "text-amber-600 dark:text-amber-400" },
  SYSTEM_ALERT: { icon: AlertTriangle, color: "text-red-500 dark:text-red-400" },
  NEW_MESSAGE: { icon: MessageSquare, color: "text-green-600 dark:text-green-400" },
  DOCUMENT_EXPIRING: { icon: FileWarning, color: "text-amber-600 dark:text-amber-400" },
  DOCUMENT_EXPIRED: { icon: FileWarning, color: "text-red-500 dark:text-red-400" },
  REFUND_REQUEST: { icon: RefreshCw, color: "text-amber-600 dark:text-amber-400" },
  REFUND_CLAIM: { icon: RefreshCw, color: "text-amber-600 dark:text-amber-400" },
  REFUND_NEEDS_ATTENTION: { icon: RefreshCw, color: "text-red-500 dark:text-red-400" },
  STRIPE_CUSTOMER_CREATE_FAILED: { icon: AlertTriangle, color: "text-red-500 dark:text-red-400" },
  SUPPLIER_CANCELLATION_REQUEST: { icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400" },
  SUPPLIER_CANCELLATION_DECIDED: { icon: ShieldCheck, color: "text-green-600 dark:text-green-400" },
};

const FALLBACK_STYLE: TypeStyle = { icon: Bell, color: "text-text-secondary" };

/**
 * Icon + text colour for a type.
 *
 * The colour is a *reinforcement* of the category and severity, never the only
 * signal — every row also carries a text label, so this stays readable in dark
 * mode and for colour-blind users.
 */
export function getNotificationTypeConfig(
  type: string,
  data?: Record<string, unknown>,
): TypeStyle {
  // 24h escalation reminders carry `reminder: true` — render them hotter than
  // the original request so a stuck queue is impossible to miss.
  if (type === "SUPPLIER_CANCELLATION_REQUEST" && data?.reminder === true) {
    return { icon: ShieldAlert, color: "text-red-500 dark:text-red-400" };
  }
  return notificationTypeConfig[type] ?? FALLBACK_STYLE;
}

/** Classes for the icon's tinted circle, shared by the bell and the page. */
export const TYPE_ICON_BG_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30";

/** Dot colour for a compact list row, keyed by category so it cannot drift per type. */
const CATEGORY_DOT_CLASS: Record<NotificationCategoryKey, string> = {
  bookings: "bg-blue-400",
  payments: "bg-emerald-400",
  suppliers: "bg-violet-400",
  content: "bg-amber-400",
  messages: "bg-cyan-400",
  system: "bg-red-400",
};

export function notificationDotClass(type: string): string {
  const key = categoryForType(type);
  return key ? CATEGORY_DOT_CLASS[key] : "bg-text-tertiary";
}

// ── Categories ─────────────────────────────────────────────────────────────

export type NotificationCategoryKey =
  | "bookings"
  | "payments"
  | "suppliers"
  | "content"
  | "messages"
  | "system";

export interface NotificationCategory {
  key: NotificationCategoryKey;
  label: string;
  icon: LucideIcon;
  /** Every type that belongs to this category. Order is presentation-only. */
  types: readonly string[];
}

/**
 * The ops team's mental model, not the enum's.
 *
 * Nobody wants to filter a feed by `PAYMENT_COLLECTION_FAILED` out of a
 * 21-item dropdown. These six groups match how the work actually arrives:
 * something to approve, something to pay, someone to onboard, something to
 * publish, someone to answer, something broken.
 */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  {
    key: "bookings",
    label: "Bookings",
    icon: ShoppingCart,
    types: [
      "BOOKING_CREATED",
      "BOOKING_CONFIRMED",
      "BOOKING_MODIFIED",
      "SUPPLIER_CANCELLATION_REQUEST",
      "SUPPLIER_CANCELLATION_DECIDED",
    ],
  },
  {
    key: "payments",
    label: "Payments & payouts",
    icon: Banknote,
    types: [
      "PAYOUT_NEEDS_APPROVAL",
      "PAYMENT_UPCOMING",
      "PAYMENT_COLLECTED",
      "PAYMENT_COLLECTION_FAILED",
      "REFUND_REQUEST",
      "REFUND_CLAIM",
      "REFUND_NEEDS_ATTENTION",
    ],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: UserPlus,
    types: [
      "NEW_SUPPLIER_APPLICATION",
      "SUPPLIER_STATUS_CHANGE",
      "DOCUMENT_EXPIRING",
      "DOCUMENT_EXPIRED",
    ],
  },
  {
    key: "content",
    label: "Tours & reviews",
    icon: ClipboardCheck,
    types: ["TOUR_SUBMITTED_FOR_REVIEW", "REVIEW_NEEDS_MODERATION"],
  },
  {
    key: "messages",
    label: "Messages",
    icon: MessageSquare,
    types: ["NEW_MESSAGE"],
  },
  {
    key: "system",
    label: "System",
    icon: AlertTriangle,
    types: ["SYSTEM_ALERT", "STRIPE_CUSTOMER_CREATE_FAILED"],
  },
];

const CATEGORY_BY_TYPE: Map<string, NotificationCategoryKey> = (() => {
  const map = new Map<string, NotificationCategoryKey>();
  for (const category of NOTIFICATION_CATEGORIES) {
    for (const type of category.types) map.set(type, category.key);
  }
  return map;
})();

/** Category a type belongs to, or `null` for a type this build doesn't know. */
export function categoryForType(type: string): NotificationCategoryKey | null {
  return CATEGORY_BY_TYPE.get(type) ?? null;
}

// ── Priority ───────────────────────────────────────────────────────────────

/**
 * Priority is a separate axis from category: the same category mixes things a
 * human must decide with things worth knowing about.
 *
 * - `action`  — someone has to approve, reject or moderate before work proceeds
 * - `warning` — degraded or at risk, but no decision is queued
 * - `info`    — a record of something that happened
 */
export type NotificationSeverity = "action" | "warning" | "info";

/** Types a human has to make a decision on. Drives the "Needs action" lens. */
export const ACTION_REQUIRED_TYPES: ReadonlySet<string> = new Set([
  "NEW_SUPPLIER_APPLICATION",
  "PAYOUT_NEEDS_APPROVAL",
  "REVIEW_NEEDS_MODERATION",
  "TOUR_SUBMITTED_FOR_REVIEW",
  "SUPPLIER_CANCELLATION_REQUEST",
  "REFUND_CLAIM",
]);

/** Degraded-but-not-queued states: expired paperwork, failed charges, alerts. */
export const WARNING_TYPES: ReadonlySet<string> = new Set([
  "SYSTEM_ALERT",
  "DOCUMENT_EXPIRING",
  "DOCUMENT_EXPIRED",
  "PAYMENT_COLLECTION_FAILED",
  "STRIPE_CUSTOMER_CREATE_FAILED",
  "REFUND_NEEDS_ATTENTION",
  "SUPPLIER_STATUS_CHANGE",
]);

export function severityForType(
  type: string,
  data?: Record<string, unknown>,
): NotificationSeverity {
  if (type === "SUPPLIER_CANCELLATION_REQUEST" && data?.reminder === true) return "action";
  if (ACTION_REQUIRED_TYPES.has(type)) return "action";
  if (WARNING_TYPES.has(type)) return "warning";
  return "info";
}

/** Short human label for a severity, used as the filter rail's second group. */
export const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  action: "Needs action",
  warning: "Warnings",
  info: "For reference",
};

/** Every type in a severity bucket, as the API's `?types=` expects. */
export function typesForSeverity(severity: NotificationSeverity): readonly string[] {
  if (severity === "action") return [...ACTION_REQUIRED_TYPES];
  if (severity === "warning") return [...WARNING_TYPES];
  return [];
}

/**
 * Types a client can send as `?types=`, grouped for the filter rail.
 * Kept next to the categories so a new category can't ship without its types.
 */
export function typesForCategory(key: NotificationCategoryKey): readonly string[] {
  return NOTIFICATION_CATEGORIES.find((c) => c.key === key)?.types ?? [];
}
