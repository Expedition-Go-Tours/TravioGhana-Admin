import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Banknote,
  Bell,
  Building2,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Heart,
  Mail,
  Map,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShoppingCart,
  Star,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SectionError } from "@/components/shared/SectionError";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { getActivityFeed } from "@/services/activityService";
import { windowRange, windowRangeLabel } from "@/lib/activityWindow";
import type { ActivityFilter, ActivityItem, ActivityWindow } from "@/types/activity";
import { cn, timeAgo } from "@/lib/utils";

const TYPE_STYLES: Record<ActivityItem["type"], string> = {
  booking: "bg-primary/10 text-primary",
  customer: "bg-accent text-accent-foreground",
  review: "bg-status-pending/10 text-status-pending-text",
  finance: "bg-status-approved/10 text-status-approved-text",
  system: "bg-surface-muted text-text-secondary",
};

const TYPE_LABELS: Record<ActivityFilter, string> = {
  all: "All activity",
  bookings: "Bookings",
  customers: "Customers",
  reviews: "Reviews",
  finance: "Finance",
  system: "System",
};

function activityIcon(item: ActivityItem) {
  const action = item.action || "";
  const className = "h-4 w-4";
  const props = { className, "aria-hidden": true } as const;
  if (action === "checkout.started") return <ShoppingCart {...props} />;
  if (action === "booking.reserved") return <Clock3 {...props} />;
  if (action === "wishlist.saved") return <Heart {...props} />;
  if (action.startsWith("review.")) return <Star {...props} />;
  if (action.startsWith("refund.")) return <RotateCcw {...props} />;
  if (action.startsWith("payout.")) return <Banknote {...props} />;
  if (action.startsWith("search.")) return <Search {...props} />;
  if (action.startsWith("newsletter.")) return <Mail {...props} />;
  if (action.startsWith("contact.")) return <MessageSquare {...props} />;
  if (action.startsWith("booking.")) return <CalendarCheck {...props} />;
  if (action.startsWith("tour.")) return <Map {...props} />;
  if (action.startsWith("supplier.")) return <Building2 {...props} />;
  if (action.startsWith("team.")) return <UserPlus {...props} />;
  if (action.startsWith("settings.")) return <Settings2 {...props} />;
  return <Activity {...props} />;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const navigate = useNavigate();
  const clickable = Boolean(item.href);
  const content = (
    <>
      <div
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
          TYPE_STYLES[item.type] || TYPE_STYLES.system,
        )}
      >
        {item.actor?.photoURL ? (
          <OptimizedImage
            src={item.actor.photoURL}
            alt=""
            width={36}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          activityIcon(item)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="line-clamp-2 text-[13px] font-medium leading-5 text-text-primary"
          title={item.summary}
        >
          {item.summary}
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4">
          {item.detail && (
            <>
              <span className="truncate text-text-secondary" title={item.detail}>
                {item.detail}
              </span>
              <span className="shrink-0 text-text-tertiary" aria-hidden="true">·</span>
            </>
          )}
          <span className="shrink-0 whitespace-nowrap tabular-nums text-text-tertiary">
            {timeAgo(item.createdAt)}
          </span>
          {clickable && (
            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
      </div>
    </>
  );

  const className = cn(
    "group flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors",
    clickable
      ? "hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      : "cursor-default",
  );

  if (!clickable) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => navigate(item.href as string)}
      aria-label={`${item.summary}. ${item.detail || ""}`.trim()}
    >
      {content}
    </button>
  );
}

export function RecentActivityPanel() {
  const [activeWindow, setActiveWindow] = useState<ActivityWindow>("today");
  const [typeFilter, setTypeFilter] = useState<ActivityFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // The range is computed in the viewer's timezone. Keying the query on its
  // start makes the feed refetch when the local day rolls over instead of
  // serving yesterday's window until the next 30s poll.
  const rangeLabel = windowRangeLabel(activeWindow);
  const rangeFrom = windowRange(activeWindow).from;

  const query = useInfiniteQuery({
    queryKey: ["admin", "activity", activeWindow, typeFilter, debouncedSearch, rangeFrom],
    queryFn: ({ pageParam }) =>
      getActivityFeed({
        window: activeWindow,
        type: typeFilter,
        q: debouncedSearch,
        cursor: pageParam as string | null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) || [],
    [query.data],
  );
  const hasMore = Boolean(query.hasNextPage);
  const countLabel = `${items.length}${hasMore ? "+" : ""}`;

  return (
    <Card className="flex h-full min-h-[400px] max-h-[460px] flex-col border border-border bg-surface-base">
      <CardHeader className="px-5 pb-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-text-primary">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="truncate">Recent Activity</span>
            <span
              className="tnum ml-auto shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-tertiary"
              aria-label={`${countLabel} activities loaded`}
            >
              {countLabel}
            </span>
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-text-tertiary hover:text-text-primary"
            onClick={() => query.refetch()}
            aria-label="Refresh activity"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
          </Button>
        </div>

        <Tabs
          value={activeWindow}
          onValueChange={(value) => setActiveWindow(value as ActivityWindow)}
          className="mt-3"
        >
          <TabsList className="h-9 w-full rounded-lg border-b-0 bg-surface-muted p-1">
            {([
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "This week"],
            ] as const).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-w-0 flex-1 shrink rounded-md px-2 text-[11px] font-medium data-[state=active]:bg-surface-base data-[state=active]:font-semibold data-[state=active]:text-text-primary"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* The period actually covered, in the viewer's own calendar. "Today"
            means nothing on its own once the server's day has rolled over. */}
        <p className="mt-1.5 text-[11px] text-text-tertiary">
          {rangeLabel}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Search activity"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 rounded-lg border-border bg-surface-muted pl-9 text-xs"
              aria-label="Search activity"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as ActivityFilter)}
          >
            <SelectTrigger
              className="h-8 w-[132px] shrink-0 rounded-lg border-border bg-surface-muted px-2.5 text-[11px]"
              aria-label="Filter activity by type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {(Object.keys(TYPE_LABELS) as ActivityFilter[]).map((value) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {TYPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-hidden p-0 px-5 pb-4">
        <div className="h-full overflow-y-auto scrollbar-thin divide-y divide-border">
          {query.isError ? (
            <SectionError
              message="Failed to load activity"
              onRetry={() => query.refetch()}
            />
          ) : query.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3 py-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-surface-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-muted" />
                  </div>
                  <div className="h-2.5 w-10 animate-pulse rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <SectionEmpty
              message={
                debouncedSearch
                  ? "No activity matches your search"
                  : "No activity in this period"
              }
            />
          ) : (
            <>
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
              {hasMore && (
                <div className="py-3 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-text-secondary"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
