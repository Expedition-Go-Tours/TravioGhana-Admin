import api from "@/lib/axios";
import type { ActivityFeedPage, ActivityFilter, ActivityWindow } from "@/types/activity";

interface GetActivityFeedParams {
  window: ActivityWindow;
  type: ActivityFilter;
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export async function getActivityFeed({
  window,
  type,
  q,
  cursor,
  limit = 20,
}: GetActivityFeedParams): Promise<ActivityFeedPage> {
  const res = await api.get("/admin/activity", {
    params: {
      window,
      type,
      limit,
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });

  const data = res.data?.data as ActivityFeedPage | undefined;
  return {
    items: data?.items || [],
    hasMore: Boolean(data?.hasMore),
    nextCursor: data?.nextCursor || null,
    window: data?.window || window,
    type: data?.type || type,
    generatedAt: data?.generatedAt || new Date().toISOString(),
  };
}
