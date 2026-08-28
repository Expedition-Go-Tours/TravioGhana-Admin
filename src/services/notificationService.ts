import api from "@/lib/axios";

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

function mapBackendNotification(n: Record<string, unknown>): AdminNotification {
  return {
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    message: n.message as string,
    data: n.data as Record<string, unknown> | undefined,
    read: (n.acknowledged as boolean) ?? false,
    readAt: (n.acknowledgedAt as string | null) || null,
    createdAt: n.createdAt as string,
  };
}

export async function getNotifications(page = 1, limit = 10, unreadOnly = false) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    unacknowledgedOnly: String(unreadOnly),
  });
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
