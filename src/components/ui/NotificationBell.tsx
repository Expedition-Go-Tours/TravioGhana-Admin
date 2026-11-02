import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X, Loader2, ChevronRight, ArrowRight } from "lucide-react";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, NOTIFICATION_FEED_ROOT, invalidateNotificationQueries } from "@/services/notificationService";
import { onAdminNotification, onAdminSocketConnect } from "@/lib/adminSocket";
import { getNotificationTypeConfig, resolveNotificationRoute } from "@/lib/notificationConfig";
import { timeAgo, cn } from "@/lib/utils";

const NOTIFICATIONS_REFETCH_INTERVAL_MS = 60_000;

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
    queryFn: () => getNotifications({ page: 1, limit: 20, unreadOnly: true }),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const notifications = dropdown?.notifications || [];

  const markRead = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });

  const markAllRead = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });

  useEffect(() => {
    // The badge is a live surface: refresh it (and the page's cached copy) the
    // moment a notification lands or the socket reconnects.
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATION_FEED_ROOT] });
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
        className="relative rounded-full p-2 text-text-secondary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-tight text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex">
          <div
            className="fixed inset-0 bg-text-primary/30"
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col border-l border-border bg-surface-base shadow-lg"
          >
            {/* Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2.5">
                <Bell className="h-5 w-5 text-primary" />
                <span className="text-base font-medium text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-primary hover:bg-accent transition-colors disabled:opacity-50"
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
                  className="rounded-full p-2 text-text-tertiary hover:bg-surface-muted transition-colors"
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
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !notifications.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                  <Bell className="mb-3 h-10 w-10" />
                  <p className="text-sm">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border-muted">
                  {notifications.map((n) => {
                    const cfg = getNotificationTypeConfig(n.type, n.data);
                    const TypeIcon = cfg.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead.mutate(n.id);
                          const result = resolveNotificationRoute(n.type, n.data);
                          if (result) {
                            setOpen(false);
                            navigate(result.path, { state: result.state });
                          }
                        }}
                        className={cn(
                          "flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-muted",
                          !n.read && "bg-accent/40",
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent", cfg.color)}>
                          <TypeIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm break-words", n.read ? "text-text-secondary" : "text-text-primary font-medium")}>
                              {n.title}
                            </p>
                            {!n.read && <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />}
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
              <Link
                to="/admin/notifications"
                onClick={() => setOpen(false)}
                className="mt-1.5 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                View all notifications
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

