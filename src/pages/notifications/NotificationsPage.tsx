import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CheckCheck, Globe, RefreshCw, Search, X } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SectionError } from "@/components/shared/SectionError";
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
  getNotificationTypeConfig,
  resolveNotificationRoute,
  severityForType,
  type NotificationCategoryKey,
} from "@/lib/notificationConfig";
import { BRAND_NAME, isOwnStorefront, storefrontLabel } from "@/lib/brand";
import { onAdminNotification, onAdminSocketConnect } from "@/lib/adminSocket";
import { timeAgo, cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

/** `all` = no filter, `action` = the decision queue, otherwise a category key. */
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

/**
 * Human time buckets for the feed.
 *
 * Grouping is presentational, so doing it per page is honest: page 3 is still
 * correctly labelled, unlike a filter, which would hide matching rows.
 */
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
  action:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300",
  warning:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300",
  info: "border-border bg-surface-muted text-text-tertiary",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter state lives in the URL ───────────────────────────────────────
  // Every view here is shareable, survives a reload, and back/forward move
  // through it — the same convention the rest of the admin already uses for
  // `?tab=` and `?bookingId=`.
  const page = readPositiveInt(searchParams.get("page"), 1);
  const requestedLimit = readPositiveInt(searchParams.get("limit"), 0);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedLimit)
    ? requestedLimit
    : DEFAULT_PAGE_SIZE;
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
    // A validated filter key always resolves to a non-empty list, so this can
    // never degrade into "no types param" and quietly return everything.
    return NOTIFICATION_CATEGORIES.find((c) => c.key === filter)?.types;
  }, [filter]);

  // ── Debounced search ────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(q);
  const appliedQ = useRef(q);

  // The URL moved without us (back/forward) — follow it.
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

  // ── Data ────────────────────────────────────────────────────────────────
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
  // Memoised so the day-grouping dependency below stays referentially stable
  // across renders while the query is still pending.
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

  // ── Live updates, on the reader's terms ─────────────────────────────────
  // A new notification must not re-sort the list underneath someone who is
  // reading it. Arrivals are counted instead, and applied only when the reader
  // asks. A reconnect is the exception: we may genuinely have missed events.
  const [pendingCount, setPendingCount] = useState(0);

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

  // ── Mutations ───────────────────────────────────────────────────────────
  const markOne = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });

  const markAll = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      setPendingCount(0);
      invalidateNotificationQueries(queryClient);
    },
  });

  const openNotification = (n: AdminNotification) => {
    if (!n.read) markOne.mutate(n.id);
    const route = resolveNotificationRoute(n.type, n.data);
    if (route) navigate(route.path, { state: route.state });
  };

  const clearFilters = () => {
    appliedQ.current = "";
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // ── Day grouping ────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const buckets: Array<{ label: string; items: AdminNotification[] }> = [];
    for (const n of notifications) {
      const label = dayBucket(n.createdAt);
      const last = buckets[buckets.length - 1];
      if (last && last.label === label) last.items.push(n);
      else buckets.push({ label, items: [n] });
    }
    return buckets;
  }, [notifications]);

  const railItemClass = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
      active
        ? "bg-primary/10 font-semibold text-primary"
        : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
    );

  const railCountClass = (active: boolean) =>
    cn("text-xs tabular-nums", active ? "text-primary" : "text-text-tertiary");

  const summaryLine = stats
    ? unreadOnly
      ? `${number.format(stats.total)} unread · ${number.format(actionCount)} need action`
      : `${number.format(stats.total)} total · ${number.format(stats.unacknowledged)} unread · ${number.format(actionCount)} need action`
    : null;

  const listIsEmpty = !feedQuery.isLoading && !feedQuery.isError && notifications.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Everything that needs your attention, newest first."
      >
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-base px-3 text-xs font-semibold text-text-secondary">
          <Globe className="h-3.5 w-3.5 text-primary" aria-hidden />
          {BRAND_NAME}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-base px-3 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            {markAll.isPending ? "Marking…" : "Mark all as read"}
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-base text-text-secondary shadow-sm transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Refresh notifications"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PageHeader>

      {summaryLine && <p className="-mt-2 text-sm text-text-tertiary">{summaryLine}</p>}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ── Filter rail ─────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav
            aria-label="Notification filters"
            className="rounded-xl border border-border/60 bg-surface-base p-3 shadow-soft"
          >
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) =>
                    updateParams({ unread: e.target.checked ? "1" : null }, { resetPage: true })
                  }
                  className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                />
                Unread only
              </span>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold tabular-nums text-text-tertiary">
                  {number.format(unreadCount)}
                </span>
              )}
            </label>

            <div className="my-2 border-t border-border-muted" />

            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => updateParams({ filter: null }, { resetPage: true })}
                  aria-current={filter === "all" ? "true" : undefined}
                  className={railItemClass(filter === "all")}
                >
                  <span>All notifications</span>
                  <span className={railCountClass(filter === "all")}>{stats ? number.format(stats.total) : "–"}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => updateParams({ filter: "action" }, { resetPage: true })}
                  aria-current={filter === "action" ? "true" : undefined}
                  className={railItemClass(filter === "action")}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-amber-500"
                      aria-hidden
                    />
                    {SEVERITY_LABELS.action}
                  </span>
                  <span className={railCountClass(filter === "action")}>
                    {stats ? number.format(actionCount) : "–"}
                  </span>
                </button>
              </li>
            </ul>

            <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Categories
            </p>

            <ul className="space-y-0.5">
              {NOTIFICATION_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const active = filter === category.key;
                return (
                  <li key={category.key}>
                    <button
                      type="button"
                      onClick={() => updateParams({ filter: category.key }, { resetPage: true })}
                      aria-current={active ? "true" : undefined}
                      className={railItemClass(active)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
                        <span className="truncate">{category.label}</span>
                      </span>
                      <span className={railCountClass(active)}>
                        {stats ? number.format(countOf(category.types)) : "–"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </nav>
        </aside>

        {/* ── Feed ────────────────────────────────────────────────────── */}
        <section className="min-w-0" aria-label="Notification feed">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search notifications…"
                aria-label="Search notifications"
                className="h-9 w-full rounded-md border border-border bg-surface-base pl-9 pr-3 text-sm text-text-primary shadow-sm outline-none transition-colors placeholder:text-text-tertiary focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={refresh}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
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
            <div className="space-y-2 rounded-xl border border-border/60 bg-surface-base p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          ) : feedQuery.isError ? (
            <div className="rounded-xl border border-border/60 bg-surface-base">
              <SectionError
                message="Couldn't load notifications"
                onRetry={() => void feedQuery.refetch()}
              />
            </div>
          ) : listIsEmpty && !hasActiveFilters ? (
            <div
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-base py-16 text-center"
              aria-live="polite"
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/40">
                <CheckCheck className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-text-primary">You're all caught up</p>
              <p className="mt-1 text-xs text-text-tertiary">
                Nothing new on {BRAND_NAME} right now.
              </p>
            </div>
          ) : listIsEmpty ? (
            <div className="rounded-xl border border-border/60 bg-surface-base">
              <SectionEmpty message="No notifications match these filters" />
              <div className="flex justify-center pb-6">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.label}>
                  <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {group.label}
                  </h2>
                  <ul className="divide-y divide-border-muted rounded-xl border border-border/60 bg-surface-base">
                    {group.items.map((n) => {
                      const cfg = getNotificationTypeConfig(n.type, n.data);
                      const TypeIcon = cfg.icon;
                      const severity = severityForType(n.type, n.data);
                      const showSeverity = severity !== "info";
                      const showStorefront = !isOwnStorefront(n.storefront);
                      const isMarkingThisOne = markOne.isPending && markOne.variables === n.id;
                      return (
                        <li
                          key={n.id}
                          className={cn(
                            "flex items-start gap-2 px-3 py-3 transition-colors hover:bg-surface-muted/50",
                            !n.read && "bg-green-50/25 dark:bg-green-950/10",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => openNotification(n)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted",
                                cfg.color,
                              )}
                            >
                              <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "text-sm break-words",
                                    n.read
                                      ? "text-text-secondary"
                                      : "text-text-primary font-medium",
                                  )}
                                >
                                  {n.title}
                                </span>
                                {showSeverity && (
                                  <span
                                    className={cn(
                                      "rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                                      SEVERITY_BADGE_CLASS[severity],
                                    )}
                                  >
                                    {SEVERITY_LABELS[severity]}
                                  </span>
                                )}
                                {showStorefront && (
                                  <span className="rounded border border-border bg-surface-muted px-1.5 py-px text-[10px] font-medium text-text-tertiary">
                                    {storefrontLabel(n.storefront)}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed break-words text-text-tertiary">
                                {n.message}
                              </span>
                              <span className="mt-1 block text-[11px] text-text-tertiary/70">
                                <time dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString("en-GB")}>
                                  {timeAgo(n.createdAt)}
                                </time>
                              </span>
                            </span>
                          </button>

                          {!n.read ? (
                            <button
                              type="button"
                              onClick={() => markOne.mutate(n.id)}
                              disabled={isMarkingThisOne}
                              aria-label={`Mark "${n.title}" as read`}
                              title="Mark as read"
                              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-muted hover:text-primary disabled:opacity-50"
                            >
                              <CheckCheck className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
