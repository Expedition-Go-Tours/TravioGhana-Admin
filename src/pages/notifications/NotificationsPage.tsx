import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Inbox,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SectionError } from "@/components/shared/SectionError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  invalidateNotificationQueries,
  NOTIFICATION_PAGE_ROOT,
  type AdminNotification,
} from "@/services/notificationService";
import {
  ACTION_REQUIRED_TYPES,
  NOTIFICATION_CATEGORIES,
  SEVERITY_LABELS,
  categoryForType,
  getNotificationTypeConfig,
  resolveNotificationRoute,
  severityForType,
  type NotificationCategoryKey,
} from "@/lib/notificationConfig";
import { BRAND_NAME, isOwnStorefront, storefrontLabel } from "@/lib/brand";
import { onAdminNotification, onAdminSocketConnect } from "@/lib/adminSocket";
import { cn, timeAgo } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type FilterKey = "all" | "action" | NotificationCategoryKey;

const KNOWN_FILTERS: ReadonlySet<string> = new Set<string>([
  "all",
  "action",
  ...NOTIFICATION_CATEGORIES.map((c) => c.key),
]);

function readFilter(raw: string | null): FilterKey {
  return raw && KNOWN_FILTERS.has(raw) ? (raw as FilterKey) : "all";
}

function readPositiveInt(raw: string | null, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dayBucket(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Earlier";
  const now = new Date();
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Earlier this week";
  if (days <= 30) return "Earlier this month";
  return "Older";
}

const number = new Intl.NumberFormat("en-US");

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  action: "border-status-pending/30 bg-status-pending/10 text-status-pending-text",
  warning: "border-status-rejected/30 bg-status-rejected/10 text-status-rejected-text",
  info: "border-border bg-surface-muted text-text-tertiary",
};

function categoryLabel(type: string) {
  const key = categoryForType(type);
  return NOTIFICATION_CATEGORIES.find((category) => category.key === key)?.label ?? "System";
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = readPositiveInt(searchParams.get("page"), 1);
  const requestedLimit = readPositiveInt(searchParams.get("limit"), 0);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
  const unreadOnly = searchParams.get("unread") === "1";
  const filter = readFilter(searchParams.get("filter"));
  const q = searchParams.get("q") ?? "";

  const hasActiveFilters = filter !== "all" || unreadOnly || q.trim().length > 0;

  const updateParams = useCallback(
    (patch: Record<string, string | null>, opts?: { resetPage?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
          }
          if (opts?.resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const typesForFilter = useMemo<readonly string[] | undefined>(() => {
    if (filter === "all") return undefined;
    if (filter === "action") return [...ACTION_REQUIRED_TYPES];
    return NOTIFICATION_CATEGORIES.find((category) => category.key === filter)?.types;
  }, [filter]);

  const [searchInput, setSearchInput] = useState(q);
  const appliedQ = useRef(q);

  useEffect(() => {
    if (q !== appliedQ.current) {
      appliedQ.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    const next = searchInput;
    if (next === appliedQ.current) return;
    const timer = setTimeout(() => {
      appliedQ.current = next;
      updateParams({ q: next }, { resetPage: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, updateParams]);

  const feedQuery = useQuery({
    queryKey: [NOTIFICATION_PAGE_ROOT, "feed", { page, pageSize, unreadOnly, filter, q }],
    queryFn: () =>
      getNotifications({ page, limit: pageSize, unreadOnly, types: typesForFilter, search: q }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: [NOTIFICATION_PAGE_ROOT, "stats", { unreadOnly }],
    queryFn: () => getNotificationStats(unreadOnly),
  });

  const stats = statsQuery.data;
  const notifications = useMemo(() => feedQuery.data?.notifications ?? [], [feedQuery.data]);
  const pagination = feedQuery.data?.pagination;

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of stats?.byType ?? []) counts.set(row.type, row._count);
    return counts;
  }, [stats]);

  const countOf = useCallback(
    (types: readonly string[]) =>
      types.reduce((sum, type) => sum + (typeCounts.get(type) ?? 0), 0),
    [typeCounts],
  );

  const unreadCount = stats?.unacknowledged ?? 0;
  const actionCount = countOf([...ACTION_REQUIRED_TYPES]);

  const [pendingCount, setPendingCount] = useState(0);
  const [selected, setSelected] = useState<AdminNotification | null>(null);

  useEffect(() => onAdminNotification(() => setPendingCount((n) => n + 1)), []);

  useEffect(
    () =>
      onAdminSocketConnect(() => {
        setPendingCount(0);
        void queryClient.invalidateQueries({ queryKey: [NOTIFICATION_PAGE_ROOT] });
      }),
    [queryClient],
  );

  const refresh = useCallback(() => {
    setPendingCount(0);
    invalidateNotificationQueries(queryClient);
  }, [queryClient]);

  const markOne = useMutation({
    mutationFn: markAsRead,
    onSuccess: (_data, id) => {
      setSelected((current) => (current?.id === id ? { ...current, read: true } : current));
      invalidateNotificationQueries(queryClient);
    },
  });

  const markAll = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      setPendingCount(0);
      setSelected((current) => (current ? { ...current, read: true } : current));
      invalidateNotificationQueries(queryClient);
    },
  });

  const openNotification = (notification: AdminNotification) => {
    setSelected(notification);
    if (!notification.read) markOne.mutate(notification.id);
  };

  const clearFilters = () => {
    appliedQ.current = "";
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const groups = useMemo(() => {
    const buckets: Array<{ label: string; items: AdminNotification[] }> = [];
    for (const notification of notifications) {
      const label = dayBucket(notification.createdAt);
      const last = buckets[buckets.length - 1];
      if (last && last.label === label) last.items.push(notification);
      else buckets.push({ label, items: [notification] });
    }
    return buckets;
  }, [notifications]);

  const listIsEmpty = !feedQuery.isLoading && !feedQuery.isError && notifications.length === 0;
  const summary = stats
    ? `${number.format(stats.total)} total · ${number.format(unreadCount)} unread · ${number.format(actionCount)} need action`
    : "Loading notification summary";

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={summary}>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-base px-3 text-xs font-medium text-text-tertiary">
          <Globe className="h-3.5 w-3.5 text-primary" aria-hidden />
          {BRAND_NAME}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAll.mutate()}
          disabled={!stats || unreadCount === 0 || markAll.isPending}
          className="h-9"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {markAll.isPending ? "Marking…" : "Mark all read"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          aria-label="Refresh notifications"
          title="Refresh"
          className="h-9 w-9 px-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4" aria-label="Notification feed">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search notifications…"
                aria-label="Search notifications"
                className="h-10 w-full rounded-md border border-input bg-surface-base pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Notification filters">
              <Button
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => updateParams({ unread: unreadOnly ? null : "1" }, { resetPage: true })}
                aria-pressed={unreadOnly}
                className="h-9"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    unreadOnly ? "bg-primary-foreground" : "bg-primary",
                  )}
                />
                Unread
                {unreadCount > 0 && (
                  <span
                    className={cn(
                      "tnum rounded-full px-1.5 py-0.5 text-[10px]",
                      unreadOnly ? "bg-white/20 text-primary-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    {number.format(unreadCount)}
                  </span>
                )}
              </Button>

              <div className="relative">
                <select
                  value={filter}
                  onChange={(event) =>
                    updateParams(
                      { filter: event.target.value === "all" ? null : event.target.value },
                      { resetPage: true },
                    )
                  }
                  aria-label="Filter notifications"
                  className="h-9 w-[190px] appearance-none rounded-full border border-input bg-surface-base pl-3 pr-8 text-xs text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All categories</option>
                  <option value="action">
                    {SEVERITY_LABELS.action}
                    {stats ? ` (${number.format(actionCount)})` : ""}
                  </option>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                      {stats ? ` (${number.format(countOf(category.types))})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" aria-hidden />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={refresh}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
              {number.format(pendingCount)} new notification{pendingCount === 1 ? "" : "s"}
            </button>
          )}

          <p className="sr-only" role="status">
            {feedQuery.isLoading
              ? "Loading notifications"
              : pagination
                ? `${number.format(pagination.totalCount)} notifications match the current filters`
                : ""}
          </p>

          {feedQuery.isLoading ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface-base p-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3 py-2.5">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          ) : feedQuery.isError ? (
            <div className="rounded-xl border border-border bg-surface-base">
              <SectionError message="Couldn't load notifications" onRetry={() => void feedQuery.refetch()} />
            </div>
          ) : listIsEmpty && !hasActiveFilters ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-base py-16 text-center" aria-live="polite">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCheck className="h-6 w-6 text-primary" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-text-primary">You're all caught up</p>
              <p className="mt-1 text-xs text-text-tertiary">Nothing new on {BRAND_NAME} right now.</p>
            </div>
          ) : listIsEmpty ? (
            <div className="rounded-xl border border-border bg-surface-base">
              <SectionEmpty message="No notifications match these filters" />
              <div className="flex justify-center pb-6">
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-surface-base">
                {groups.map((group, groupIndex) => (
                  <section key={group.label}>
                    <div
                      className={cn(
                        "flex items-center justify-between bg-surface-muted px-4 py-2",
                        groupIndex > 0 && "border-t border-border",
                      )}
                    >
                      <h2 className="text-[11px] font-medium text-text-tertiary">{group.label}</h2>
                      <span className="tnum text-[11px] text-text-tertiary">{group.items.length}</span>
                    </div>
                    <ul className="divide-y divide-border">
                      {group.items.map((notification) => {
                        const cfg = getNotificationTypeConfig(notification.type, notification.data);
                        const TypeIcon = cfg.icon;
                        const severity = severityForType(notification.type, notification.data);
                        const showSeverity = severity !== "info";
                        const showStorefront = !isOwnStorefront(notification.storefront);
                        const isSelected = selected?.id === notification.id;
                        const isMarking = markOne.isPending && markOne.variables === notification.id;

                        return (
                          <li
                            key={notification.id}
                            className={cn(
                              "group flex items-start gap-1 pr-2 transition-colors",
                              !notification.read && "bg-primary/[0.03]",
                              isSelected && "bg-primary/5",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => openNotification(notification)}
                              className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                            >
                              <span className="relative mt-0.5 shrink-0">
                                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted", cfg.color)}>
                                  <TypeIcon className="h-4 w-4" aria-hidden />
                                </span>
                                {!notification.read && (
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-base bg-primary" />
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-3">
                                  <span
                                    className={cn(
                                      "min-w-0 text-sm leading-snug",
                                      notification.read
                                        ? "text-text-secondary"
                                        : "font-medium text-text-primary",
                                    )}
                                  >
                                    {notification.title}
                                  </span>
                                  <time
                                    dateTime={notification.createdAt}
                                    title={new Date(notification.createdAt).toLocaleString("en-GB")}
                                    className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-text-tertiary"
                                  >
                                    {timeAgo(notification.createdAt)}
                                  </time>
                                </span>

                                <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-tertiary">
                                  {notification.message}
                                </span>

                                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-border bg-surface-base px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
                                    {categoryLabel(notification.type)}
                                  </span>
                                  {showSeverity && (
                                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", SEVERITY_BADGE_CLASS[severity])}>
                                      {SEVERITY_LABELS[severity]}
                                    </span>
                                  )}
                                  {showStorefront && (
                                    <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
                                      {storefrontLabel(notification.storefront)}
                                    </span>
                                  )}
                                </span>
                              </span>

                              <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                            </button>

                            {!notification.read && (
                              <button
                                type="button"
                                onClick={() => markOne.mutate(notification.id)}
                                disabled={isMarking}
                                aria-label={`Mark "${notification.title}" as read`}
                                title="Mark as read"
                                className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-muted hover:text-primary disabled:opacity-50"
                              >
                                <CheckCheck className="h-4 w-4" aria-hidden />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>

              {pagination && (
                <Pagination
                  page={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  pageSize={pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={(next) => updateParams({ page: String(next) })}
                  onPageSizeChange={(size) => updateParams({ limit: String(size) }, { resetPage: true })}
                />
              )}
            </>
          )}
        </section>

        <aside className="hidden xl:block" aria-label="Notification details">
          <div className="sticky top-6 flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface-base">
            {selected ? (
              <NotificationDetail
                key={selected.id}
                className="flex-1 animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none"
                notification={selected}
                marking={markOne.isPending && markOne.variables === selected.id}
                onMarkRead={() => markOne.mutate(selected.id)}
                onOpen={() => {
                  const route = resolveNotificationRoute(selected.type, selected.data);
                  if (route) navigate(route.path, { state: route.state });
                }}
              />
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center px-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                  <Inbox className="h-5 w-5 text-text-tertiary" />
                </span>
                <p className="mt-3 text-sm font-medium text-text-primary">Select a notification</p>
                <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-text-tertiary">
                  Open a row to read the full message and jump to the related record.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selected && createPortal(
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 animate-in fade-in bg-text-primary/30 duration-200 motion-reduce:animate-none"
            onClick={() => setSelected(null)}
            aria-label="Close notification details"
          />
          <div className="absolute inset-x-0 bottom-0 top-0 flex animate-in flex-col bg-surface-base duration-300 slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-4 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
            <NotificationDetail
              key={selected.id}
              notification={selected}
              marking={markOne.isPending && markOne.variables === selected.id}
              onClose={() => setSelected(null)}
              onMarkRead={() => markOne.mutate(selected.id)}
              onOpen={() => {
                const route = resolveNotificationRoute(selected.type, selected.data);
                if (route) navigate(route.path, { state: route.state });
              }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function NotificationDetail({
  notification,
  marking,
  onClose,
  onMarkRead,
  onOpen,
  className,
}: {
  notification: AdminNotification;
  marking?: boolean;
  onClose?: () => void;
  onMarkRead: () => void;
  onOpen: () => void;
  className?: string;
}) {
  const cfg = getNotificationTypeConfig(notification.type, notification.data);
  const TypeIcon = cfg.icon;
  const severity = severityForType(notification.type, notification.data);
  const category = categoryLabel(notification.type);
  const showStorefront = !isOwnStorefront(notification.storefront);
  const route = resolveNotificationRoute(notification.type, notification.data);
  const received = new Date(notification.createdAt);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted", cfg.color)}>
          <TypeIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-text-tertiary">{category}</p>
          <h2 className="mt-0.5 text-[15px] font-medium leading-snug text-text-primary">
            {notification.title}
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
          {notification.message}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", SEVERITY_BADGE_CLASS[severity])}>
            {SEVERITY_LABELS[severity]}
          </span>
          {showStorefront && (
            <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
              {storefrontLabel(notification.storefront)}
            </span>
          )}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
              notification.read
                ? "border-border bg-surface-muted text-text-tertiary"
                : "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            {notification.read ? "Read" : "Unread"}
          </span>
        </div>

        <dl className="space-y-3 border-t border-border pt-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-text-tertiary">Received</dt>
            <dd className="text-right text-text-secondary">
              <time dateTime={notification.createdAt}>
                {received.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-text-tertiary">Priority</dt>
            <dd className="text-right text-text-secondary">{SEVERITY_LABELS[severity]}</dd>
          </div>
          {notification.readAt && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-text-tertiary">Read</dt>
              <dd className="text-right text-text-secondary">
                <time dateTime={notification.readAt}>
                  {new Date(notification.readAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <dt className="text-text-tertiary">Source</dt>
            <dd className="text-right text-text-secondary">
              {showStorefront ? storefrontLabel(notification.storefront) : BRAND_NAME}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border p-4">
        {route && (
          <Button onClick={onOpen} className="flex-1">
            Open record
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        {!notification.read && (
          <Button variant="outline" onClick={onMarkRead} disabled={marking} className="flex-1">
            <CheckCheck className="h-3.5 w-3.5" />
            {marking ? "Marking…" : "Mark as read"}
          </Button>
        )}
        {notification.read && !route && (
          <span className="flex flex-1 items-center justify-center gap-1.5 text-xs text-text-tertiary">
            <Clock className="h-3.5 w-3.5" /> No further action
          </span>
        )}
      </div>
    </div>
  );
}
