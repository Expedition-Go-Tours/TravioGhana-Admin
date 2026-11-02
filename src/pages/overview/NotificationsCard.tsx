import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Users, Star, Banknote, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  markAllAsRead,
  invalidateNotificationQueries,
  NOTIFICATION_OVERVIEW_ROOT,
  type NotificationStats,
} from "@/services/notificationService";
import {
  hasNotificationRoute,
  notificationDotClass,
  resolveNotificationRoute,
} from "@/lib/notificationConfig";
import { timeAgo, cn } from "@/lib/utils";
import { SectionError } from "@/components/shared/SectionError";

interface NotificationsCardProps {
  data?: NotificationStats;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const statItems = [
  { type: "NEW_SUPPLIER_APPLICATION", label: "Apps", icon: Users, route: "/admin/suppliers" },
  { type: "TOUR_SUBMITTED_FOR_REVIEW", label: "Tours", icon: ClipboardCheck, route: "/admin/tour-moderation" },
  { type: "REVIEW_NEEDS_MODERATION", label: "Review", icon: Star, route: "/admin/reviews" },
  { type: "PAYOUT_NEEDS_APPROVAL", label: "Payouts", icon: Banknote, route: "/admin/payouts" },
];

const numberColor = [
  "text-status-pending-text dark:text-status-pending-text",
  "text-status-pending-text dark:text-status-pending-text",
  "text-status-approved-text dark:text-status-approved-text",
  "text-status-active-text",
];

const iconBg = [
  "bg-status-pending/10 dark:bg-status-pending/10",
  "bg-status-pending/10 dark:bg-status-pending/10",
  "bg-status-approved/10 dark:bg-status-approved/10",
  "bg-primary/10 dark:bg-primary/10",
];

export function NotificationsCard({ data, loading, error, onRetry }: NotificationsCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const countFor = (type: string) => data?.byType?.find((t) => t.type === type)?._count ?? 0;

  const markAllRead = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_OVERVIEW_ROOT });
      invalidateNotificationQueries(queryClient);
    },
  });

  if (loading) {
    return (
      <Card className="h-full border border-border  bg-surface-base rounded-xl">
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
  const hasAnyContent = !error && (unacknowledged > 0 || recent.length > 0);

  return (
    <Card className="h-full border border-border  bg-surface-base rounded-xl">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-status-pending/10 dark:bg-status-pending/10 text-status-pending-text dark:text-status-pending-text">
              <Bell className="h-4 w-4" />
            </span>
            Notifications
          </CardTitle>
          <div className="flex items-center gap-3">
            {unacknowledged > 0 && (
              <span className="tnum rounded-full bg-status-rejected px-2 py-0.5 text-[11px] font-semibold text-white">
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
        {error ? (
          <SectionError message="Failed to load notifications" onRetry={onRetry} />
        ) : hasAnyContent ? (
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
                      "flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors",
                      has
                        ? "border-border bg-surface-base hover:border-primary/30"
                        : "bg-surface-base border-border hover:border-border"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-xl", has ? iconBg[idx] : "bg-surface-muted")}>
                      <Icon className={cn("h-3.5 w-3.5", has ? numberColor[idx] : "text-text-tertiary")} />
                    </div>
                    {has ? (
                      <span className={cn("tnum text-lg font-semibold leading-none", numberColor[idx])}>{count}</span>
                    ) : (
                      <span className="text-lg font-semibold leading-none text-text-tertiary">&ndash;</span>
                    )}
                    <span className={cn("text-[10px] font-medium", has ? "text-text-secondary" : "text-text-tertiary")}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {recent.length > 0 && (
              <div className="divide-y divide-border">
                {recent.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      const route = resolveNotificationRoute(n.type, n.data);
                      if (route) navigate(route.path, { state: route.state });
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 py-2.5 text-left transition-colors",
                      "hover:bg-surface-muted -mx-5 px-5 rounded-xl",
                      hasNotificationRoute(n.type, n.data) ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", notificationDotClass(n.type))} />
                    <p
                      className={cn(
                        "text-sm flex-1 min-w-0 truncate",
                        n.acknowledged ? "text-text-secondary" : "text-text-primary font-semibold"
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
            <div className="p-2.5 rounded-full bg-primary/10 dark:bg-primary/10 mb-2.5">
              <CheckCheck className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-text-secondary">All clear</p>
            <p className="text-xs text-text-tertiary mt-0.5">No pending notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}