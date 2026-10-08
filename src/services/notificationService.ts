import type { QueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";

/**
 * Query roots for notification data.
 *
 * They are deliberately separate. The bell's badge and the overview card are
 * always-on surfaces that refresh the moment the socket reports a change. The
 * full page does not: re-sorting a long feed underneath someone who is reading
 * it is how people click the wrong row, so the page holds its data until the
 * reader asks for new items (its "new notifications" pill) or changes filter.
 *
 * Mutations must invalidate every root, so a change made on one surface shows
 * up on the others.
 */
export const NOTIFICATION_FEED_ROOT = "admin-notifications";
export const NOTIFICATION_PAGE_ROOT = "admin-notifications-page";
/**
 * The overview card's summary query. It predates the feed/page split and keeps
 * its own key so the always-on dashboard card is not re-sorted while someone
 * is working on the full page; it is still invalidated by every mutation.
 */
export const NOTIFICATION_OVERVIEW_ROOT = ["admin", "notifications", "stats"] as const;

export function invalidateNotificationQueries(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: [NOTIFICATION_FEED_ROOT] });
  void client.invalidateQueries({ queryKey: [NOTIFICATION_PAGE_ROOT] });
  void client.invalidateQueries({ queryKey: NOTIFICATION_OVERVIEW_ROOT });
}


export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  /**
   * Storefront this notification was created against: `"ghana"`,
   * `"expedition"`, or `null` for platform-wide. The API has already scoped
   * the feed to this admin's brand before it reaches the client — this is
   * surfaced so mixed feeds can be labelled, never filtered by hand.
   */
  storefront?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

/**
 * An item inside the `recent` array of `/admin/notifications/stats`.
 *
 * The stats endpoint hands back Prisma's `acknowledged` naming verbatim; the
 * paginated feed goes through mapBackendNotification and is exposed as `read`.
 * Both shapes are kept because the overview card and the bell each render a
 * different one.
 */
export interface NotificationRecentItem {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  storefront?: string | null;
  acknowledged: boolean;
  createdAt: string;
}

/** Response body of `GET /admin/notifications/stats`. */
export interface NotificationStats {
  total: number;
  unacknowledged: number;
  byType: Array<{ type: string; _count: number }>;
  recent: NotificationRecentItem[];
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  /** Exact `AdminNotificationType` values to include; unknown values are dropped server-side. */
  types?: readonly string[];
  /** Free-text match against title and message. */
  search?: string;
}

export interface NotificationListResult {
  notifications: AdminNotification[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    unreadCount: number;
    limit: number;
  };
}

function mapBackendNotification(n: Record<string, unknown>): AdminNotification {
  return {
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    message: n.message as string,
    data: n.data as Record<string, unknown> | undefined,
    storefront: (n.storefront as string | null | undefined) ?? null,
    read: (n.acknowledged as boolean) ?? false,
    readAt: (n.acknowledgedAt as string | null) || null,
    createdAt: n.createdAt as string,
  };
}

/**
 * Paginated, filterable feed.
 *
 * `types` and `search` are applied by the API before pagination, so the totals
 * in `pagination` always describe the filtered set — a filter can never claim
 * "no results" while matching rows sit on a later page.
 */
export async function getNotifications({
  page = 1,
  limit = 10,
  unreadOnly = false,
  types,
  search,
}: NotificationListParams = {}): Promise<NotificationListResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    unacknowledgedOnly: String(unreadOnly),
  });
  if (types && types.length > 0) params.set("types", types.join(","));
  if (search && search.trim()) params.set("search", search.trim());

  const res = await api.get(`/admin/notifications?${params.toString()}`);
  const body = res.data.data as {
    notifications: Record<string, unknown>[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      unacknowledgedCount: number;
      limit: number;
    };
  };
  return {
    notifications: (body.notifications || []).map(mapBackendNotification),
    pagination: {
      currentPage: body.pagination.currentPage,
      totalPages: body.pagination.totalPages,
      totalCount: body.pagination.totalCount,
      unreadCount: body.pagination.unacknowledgedCount ?? 0,
      limit: body.pagination.limit,
    },
  };
}

/**
 * Aggregates for the filter rail and summary cards.
 *
 * Pass `unreadOnly` to make every count describe the unread subset, so a rail
 * count can't advertise 145 items while the list underneath shows 5.
 */
export async function getNotificationStats(unreadOnly = false): Promise<NotificationStats> {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unacknowledgedOnly", "true");
  const qs = params.toString();

  const res = await api.get(`/admin/notifications/stats${qs ? `?${qs}` : ""}`);
  const body = res.data.data as Partial<NotificationStats>;
  return {
    total: body.total ?? 0,
    unacknowledged: body.unacknowledged ?? 0,
    byType: body.byType ?? [],
    recent: body.recent ?? [],
  };
}

export async function getUnreadCount() {
  const res = await api.get("/admin/notifications/unread-count");
  const body = res.data.data as { unacknowledgedCount: number };
  return body.unacknowledgedCount ?? 0;
}

export async function markAsRead(id: string) {
  await api.patch(`/admin/notifications/${id}/acknowledge`);
}

export async function markAllAsRead() {
  await api.patch("/admin/notifications/acknowledge-all");
}
