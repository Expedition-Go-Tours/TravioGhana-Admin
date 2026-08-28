import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  X,
  MessageSquare,
  ShoppingBag,
  XCircle,
  CreditCard,
  Banknote,
  Star,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "@/services/notificationService";
import { onAdminNotification, onAdminSocketConnect } from "@/lib/adminSocket";
import { timeAgo, cn } from "@/lib/utils";

const NOTIFICATIONS_REFETCH_INTERVAL_MS = 60_000;

const notificationRouteMap: Record<string, (data?: Record<string, unknown>) => { path: string; state?: Record<string, unknown> } | null> = {
  NEW_SUPPLIER_APPLICATION: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : null,
  SUPPLIER_STATUS_CHANGE: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : null,
  REVIEW_NEEDS_MODERATION: (data) => data?.reviewId ? { path: "/admin/reviews", state: { reviewId: data.reviewId } } : null,
  TOUR_SUBMITTED_FOR_REVIEW: (data) => data?.tourId ? { path: "/admin/tour-moderation", state: { tourId: data.tourId } } : null,
  PAYOUT_NEEDS_APPROVAL: (data) => ({ path: "/admin/payouts", state: { payoutId: data?.payoutId || data?.payoutRequestId } }),
  BOOKING_CREATED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  BOOKING_CONFIRMED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  DOCUMENT_EXPIRING: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin/suppliers" },
  DOCUMENT_EXPIRED: (data) => data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin/suppliers" },
  REFUND_REQUEST: (data) => data?.disputeId ? { path: "/admin/payouts?tab=disputes", state: { disputeId: data.disputeId } } : { path: "/admin/payouts?tab=disputes" },
  PAYMENT_UPCOMING: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  PAYMENT_COLLECTED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  PAYMENT_COLLECTION_FAILED: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/bookings" },
  STRIPE_CUSTOMER_CREATE_FAILED: () => ({ path: "/admin/settings" }),
  REFUND_NEEDS_ATTENTION: (data) => data?.bookingId ? { path: `/admin/bookings?bookingId=${data.bookingId}` } : { path: "/admin/payouts?tab=disputes" },
  SYSTEM_ALERT: (data) => data?.payoutMethodId ? { path: "/admin/payouts?tab=methods", state: { viewSupplierId: data.supplierId } } : data?.supplierId ? { path: `/admin/suppliers/${data.supplierId}` } : { path: "/admin" },
  NEW_MESSAGE: (data) => {
    if (!data?.conversationId) return null;
    if (data.conversationType === 'SUPPLIER_CUSTOMER') return { path: "/admin/chat/customers" };
    return { path: `/admin/chat/${data.chatType || "suppliers"}`, state: { conversationId: data.conversationId } };
  },
};

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  BOOKING_CONFIRMED: { icon: <ShoppingBag className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  BOOKING_CANCELLED: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  BOOKING_CREATED: { icon: <ShoppingBag className="h-3.5 w-3.5" />, color: "text-blue-600 dark:text-blue-400" },
  PAYMENT_RECEIVED: { icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  PAYMENT_UPCOMING: { icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  PAYMENT_COLLECTED: { icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  PAYMENT_COLLECTION_FAILED: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  PAYOUT_NEEDS_APPROVAL: { icon: <Banknote className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  PAYOUT_COMPLETED: { icon: <Banknote className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  PAYOUT_REQUEST_SUBMITTED: { icon: <Banknote className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  PAYOUT_REQUEST_APPROVED: { icon: <Banknote className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  PAYOUT_REQUEST_REJECTED: { icon: <Banknote className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  REVIEW_RECEIVED: { icon: <Star className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  SUPPLIER_APPROVED: { icon: <UserCheck className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  SUPPLIER_REJECTED: { icon: <UserX className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  NEW_SUPPLIER_APPLICATION: { icon: <UserCheck className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  SUPPLIER_STATUS_CHANGE: { icon: <UserCheck className="h-3.5 w-3.5" />, color: "text-blue-600 dark:text-blue-400" },
  REVIEW_NEEDS_MODERATION: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  TOUR_SUBMITTED_FOR_REVIEW: { icon: <ClipboardCheck className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  SYSTEM_ALERT: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  NEW_MESSAGE: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  DOCUMENT_EXPIRING: { icon: <FileWarning className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  DOCUMENT_EXPIRED: { icon: <FileWarning className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  REFUND_REQUEST: { icon: <RefreshCw className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
  REFUND_NEEDS_ATTENTION: { icon: <RefreshCw className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
  STRIPE_CUSTOMER_CREATE_FAILED: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-red-500 dark:text-red-400" },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || { icon: <Bell className="h-3.5 w-3.5" />, color: "text-text-secondary" };
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["admin-notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: NOTIFICATIONS_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });

  const { data: dropdown, isLoading } = useQuery({
    queryKey: ["admin-notifications", "feed"],
    queryFn: () => getNotifications(1, 20, true),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const notifications = dropdown?.notifications || [];

  const markRead = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    };
    const cleanupNotification = onAdminNotification(invalidate);
    const cleanupConnect = onAdminSocketConnect(invalidate);
    return () => {
      cleanupNotification();
      cleanupConnect();
    };
  }, [queryClient]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-sm p-1.5 text-text-secondary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/30"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-tight text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col bg-surface-base shadow-2xl"
          >
            {/* Header */}
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2.5">
                <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-base font-semibold text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors disabled:opacity-50"
                  >
                    {markAllRead.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3 w-3" />
                    )}
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-sm p-1.5 text-text-tertiary hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600 dark:text-green-400" />
                </div>
              ) : !notifications.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                  <Bell className="mb-3 h-10 w-10" />
                  <p className="text-sm">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border-muted">
                  {notifications.map((n) => {
                    const cfg = getTypeConfig(n.type);
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead.mutate(n.id);
                          const result = notificationRouteMap[n.type]?.(n.data);
                          if (result) {
                            setOpen(false);
                            navigate(result.path, { state: result.state });
                          }
                        }}
                        className={cn(
                          "flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-green-50/40 dark:hover:bg-green-950/20",
                          !n.read && "bg-green-50/20 dark:bg-green-950/15",
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30", cfg.color)}>
                          {cfg.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm break-words", n.read ? "text-text-secondary" : "text-text-primary font-medium")}>
                              {n.title}
                            </p>
                            {!n.read && <span className="shrink-0 h-2 w-2 rounded-full bg-green-500" />}
                          </div>
                          <p className="mt-0.5 text-xs text-text-tertiary break-words leading-relaxed">{n.message}</p>
                          <p className="mt-1 text-[10px] text-text-tertiary/60">{timeAgo(n.createdAt)}</p>
                        </div>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-text-tertiary/30" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border-muted px-5 py-3">
              <p className="text-center text-[11px] text-text-tertiary">
                {dropdown?.pagination?.unreadCount ?? 0} unread · {dropdown?.pagination?.totalCount ?? 0} total
              </p>
            </div>
          </motion.aside>
        </div>,
        document.body,
      )}
    </>
  );
}


