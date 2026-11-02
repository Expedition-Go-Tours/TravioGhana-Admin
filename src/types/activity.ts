export type ActivityType = "booking" | "customer" | "review" | "finance" | "system";

export type ActivityWindow = "today" | "yesterday" | "week";

export type ActivityFilter = "all" | "bookings" | "customers" | "reviews" | "finance" | "system";

export interface ActivityActor {
  id: string | null;
  name: string;
  role: "customer" | "supplier" | "admin" | "staff" | "system";
  photoURL?: string | null;
}

export interface ActivityObject {
  type: string;
  id: string | null;
  label: string;
}

export interface ActivityItem {
  id: string;
  source: "booking" | "review" | "wishlist" | "refund" | "payout" | "event" | "audit";
  type: ActivityType;
  action: string;
  summary: string;
  detail?: string | null;
  actor?: ActivityActor | null;
  object?: ActivityObject | null;
  amount?: number | null;
  currency?: string | null;
  href?: string | null;
  createdAt: string;
}

export interface ActivityFeedPage {
  items: ActivityItem[];
  hasMore: boolean;
  nextCursor: string | null;
  window: ActivityWindow;
  type: ActivityFilter;
  generatedAt: string;
}
