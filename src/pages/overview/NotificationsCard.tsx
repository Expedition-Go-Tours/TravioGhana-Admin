import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Users, Star, Banknote, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { markAllAsRead } from "@/services/notificationService";
import { timeAgo, cn } from "@/lib/utils";

export interface RecentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: string;
}

export interface NotificationStats {
  total: number;
  unacknowledged: number;
  byType: Array<{ type: string; _count: number }>;
  recent: Array<RecentNotification>;
}

interface NotificationsCardProps {
  data?: NotificationStats;
  loading?: boolean;
}

const dotColors: Record<string, string> = {
  NEW_SUPPLIER_APPLICATION: "bg-amber-400",
  REVIEW_NEEDS_MODERATION: "bg-blue-400",
  TOUR_SUBMITTED_FOR_REVIEW: "bg-amber-400",
  PAYOUT_NEEDS_APPROVAL: "bg-emerald-400",
  PAYOUT_PROCESSED: "bg-green-400",
  PAYOUT_APPROVED: "bg-green-400",
  PAYOUT_COMPLETED: "bg-green-400",
  PAYOUT_REQUEST_SUBMITTED: "bg-emerald-400",
  PAYOUT_REQUEST_APPROVED: "bg-green-400",
  PAYOUT_REQUEST_REJECTED: "bg-red-400",
  SUPPLIER_STATUS_CHANGE: "bg-violet-400",
  SYSTEM_ALERT: "bg-red-400",
  NEW_MESSAGE: "bg-cyan-400",
};

const dotColor = (type: string) => dotColors[type] || "bg-text-tertiary";

const notificationRouteMap: Record<string, (data?: Record<string, unknown>) => { path: string; state?: Record<string, unknown> } | null> = {
  NEW_SUPPLIER_APPLICATION: (d) => (d?.supplierId ? { path: `/admin/suppliers/${d.supplierId}` } : null),
  SUPPLIER_STATUS_CHANGE: (d) => (d?.supplierId ? { path: `/admin/suppliers/${d.supplierId}` } : null),
  REVIEW_NEEDS_MODERATION: (d) => (d?.reviewId ? { path: "/admin/reviews", state: { reviewId: d.reviewId } } : null),
  TOUR_SUBMITTED_FOR_REVIEW: (d) => (d?.tourId ? { path: "/admin/tour-moderation", state: { tourId: d.tourId } } : null),
  PAYOUT_NEEDS_APPROVAL: (d) => ({ path: "/admin/payouts", state: { payoutId: d?.payoutId || d?.payoutRequestId } }),
  BOOKING_CREATED: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/bookings" }),
  BOOKING_CONFIRMED: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/bookings" }),
  DOCUMENT_EXPIRING: (d) => (d?.supplierId ? { path: `/admin/suppliers/${d.supplierId}` } : { path: "/admin/suppliers" }),
  DOCUMENT_EXPIRED: (d) => (d?.supplierId ? { path: `/admin/suppliers/${d.supplierId}` } : { path: "/admin/suppliers" }),
  REFUND_REQUEST: (d) => (d?.disputeId ? { path: "/admin/payouts?tab=disputes", state: { disputeId: d.disputeId } } : { path: "/admin/payouts?tab=disputes" }),
  PAYMENT_UPCOMING: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/bookings" }),
  PAYMENT_COLLECTED: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/bookings" }),
  PAYMENT_COLLECTION_FAILED: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/bookings" }),
  STRIPE_CUSTOMER_CREATE_FAILED: () => ({ path: "/admin/settings" }),
  REFUND_NEEDS_ATTENTION: (d) => (d?.bookingId ? { path: `/admin/bookings?bookingId=${d.bookingId}` } : { path: "/admin/payouts?tab=disputes" }),
  SYSTEM_ALERT: (d) => d?.payoutMethodId ? { path: "/admin/payouts?tab=methods", state: { viewSupplierId: d.supplierId } } : d?.supplierId ? { path: `/admin/suppliers/${d.supplierId}` } : { path: "/admin" },
  NEW_MESSAGE: (d) => {
    if (!d?.conversationId) return null;
    if (d.conversationType === 'SUPPLIER_CUSTOMER') return { path: "/admin/chat/customers" };
    return { path: `/admin/chat/${d.chatType || "suppliers"}`, state: { conversationId: d.conversationId } };
  },
};

const statItems = [
  { type: "NEW_SUPPLIER_APPLICATION", label: "Apps", icon: Users, route: "/admin/suppliers" },
  { type: "TOUR_SUBMITTED_FOR_REVIEW", label: "Tours", icon: ClipboardCheck, route: "/admin/tour-moderation" },
  { type: "REVIEW_NEEDS_MODERATION", label: "Review", icon: Star, route: "/admin/reviews" },
  { type: "PAYOUT_NEEDS_APPROVAL", label: "Payouts", icon: Banknote, route: "/admin/payouts" },
];

const numberColor = [
  "text-amber-600 dark:text-amber-400",
  "text-amber-600 dark:text-amber-400",
  "text-blue-600 dark:text-blue-400",
  "text-status-active",
];

const iconBg = [
  "bg-amber-50 dark:bg-amber-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
  "bg-blue-50 dark:bg-blue-950/40",
  "bg-green-50 dark:bg-green-950/40",
];

export function NotificationsCard({ data, loading }: NotificationsCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const countFor = (type: string) => data?.byType?.find((t) => t.type === type)?._count ?? 0;

  const markAllRead = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  if (loading) {
    return (
      <Card className="h-full border border-border/60 shadow-soft bg-surface-base rounded-2xl">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-[72px] rounded-xl" />
            ))}
          </div>
          <div className="space-y-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const unacknowledged = data?.unacknowledged ?? 0;
  const recent = data?.recent ?? [];
  const hasAnyContent = unacknowledged > 0 || recent.length > 0;

  return (
    <Card className="h-full border border-border/60 shadow-soft bg-surface-base rounded-2xl">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              <Bell className="h-4 w-4" />
            </span>
            Notifications
          </CardTitle>
          <div className="flex items-center gap-3">
            {unacknowledged > 0 && (
              <span className="text-[11px] font-semibold text-white bg-gradient-to-r from-red-500 to-red-400 px-2 py-0.5 rounded-full shadow-sm">
                {unacknowledged}
              </span>
            )}
            {unacknowledged > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" />
                Done
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {hasAnyContent ? (
          <div className="space-y-5">
            <div className="flex gap-2.5">
              {statItems.map((item, idx) => {
                const count = countFor(item.type);
                const Icon = item.icon;
                const has = count > 0;
                return (
                  <button
                    key={item.type}
                    onClick={() => navigate(item.route)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all",
                      has
                        ? "bg-surface-base border-border hover:border-primary/30 hover:shadow-sm"
                        : "bg-surface-base border-border/50 hover:border-border"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg", has ? iconBg[idx] : "bg-surface-muted")}>
                      <Icon className={cn("h-3.5 w-3.5", has ? numberColor[idx] : "text-text-tertiary")} />
                    </div>
                    {has ? (
                      <span className={cn("text-lg font-bold leading-none", numberColor[idx])}>{count}</span>
                    ) : (
                      <span className="text-lg font-bold leading-none text-text-tertiary">&ndash;</span>
                    )}
                    <span className={cn("text-[10px] font-medium", has ? "text-text-secondary" : "text-text-tertiary")}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {recent.length > 0 && (
              <div className="divide-y divide-border/50">
                {recent.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      const route = notificationRouteMap[n.type]?.(n.data);
                      if (route) navigate(route.path, { state: route.state });
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 py-2.5 text-left transition-colors cursor-pointer",
                      "hover:bg-surface-muted -mx-5 px-5 rounded-lg",
                      notificationRouteMap[n.type] ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor(n.type))} />
                    <p
                      className={cn(
                        "text-sm flex-1 min-w-0 truncate",
                        n.acknowledged ? "text-text-secondary" : "text-text-primary font-medium"
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="text-[11px] text-text-tertiary whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-2.5 rounded-full bg-green-50 dark:bg-green-950/40 mb-2.5">
              <CheckCheck className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-sm font-medium text-text-secondary">All clear</p>
            <p className="text-xs text-text-tertiary mt-0.5">No pending notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
