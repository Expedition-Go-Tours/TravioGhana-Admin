import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from "lucide-react";

import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { useAuthContext } from "@/auth/auth-context";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import OptimizedImage from "@/components/shared/OptimizedImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getNavGroups, type NavGroup, type NavItem } from "@/components/layout/navConfig";
import { getUnreadCount, NOTIFICATION_FEED_ROOT } from "@/services/notificationService";
import travioWordmark from "@/assets/travio-ghana-wordmark.png";
import travioWordmarkDark from "@/assets/travio-ghana-wordmark-on-dark.png";
import travioBadge from "@/assets/travio-ghana-badge.png";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed";

function useSidebarCounts(can: (key: string) => boolean) {
  const canBookings = can("bookings.view") || can("dashboard.*");
  const canReviews = can("reviews.view");
  const canTours = can("tours.approve") || can("tours.view");
  const canCancellations = can("bookings.view") || can("dashboard.*");
  const canNotifications = can("notifications.view");

  const bookingsQuery = useQuery({
    queryKey: ["admin", "bookings", "sidebar-count"],
    queryFn: () => api.get("/admin/bookings?limit=1").then((r) => r.data?.data?.counts?.PENDING ?? 0),
    enabled: canBookings,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin", "reviews-pending-count"],
    queryFn: () => api.get("/reviews/admin/pending?limit=1").then((r) => r.data?.data?.counts?.pending ?? 0),
    enabled: canReviews,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const toursQuery = useQuery({
    queryKey: ["admin", "tour-review", "sidebar-count"],
    queryFn: () => api.get("/admin/tours/review?limit=1").then((r) => r.data?.data?.counts?.pending ?? 0),
    enabled: canTours,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const cancellationsQuery = useQuery({
    queryKey: ["admin", "cancellations", "sidebar-count"],
    queryFn: () =>
      api
        .get("/admin/cancellation-requests?status=PENDING_APPROVAL&limit=1")
        .then((r) => r.data?.data?.pendingCount ?? 0),
    enabled: canCancellations,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  useSocketInvalidate("admin:new-booking", ["admin", "bookings"]);
  useSocketInvalidate("admin:new-review", ["admin", "reviews-pending-count"]);
  useSocketInvalidate("admin:tour-update", ["admin", "tour-review"]);
  useSocketInvalidate("admin-notification", ["admin", "cancellations"]);

  const notificationsQuery = useQuery({
    queryKey: [NOTIFICATION_FEED_ROOT, "unread-count"],
    queryFn: getUnreadCount,
    enabled: canNotifications,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  return {
    bookings: bookingsQuery.data ?? 0,
    reviews: reviewsQuery.data ?? 0,
    tours: toursQuery.data ?? 0,
    cancellations: cancellationsQuery.data ?? 0,
    notifications: notificationsQuery.data ?? 0,
  };
}

function CountBadge({ value, label, subtle }: { value: number; label: string; subtle?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
        subtle ? "bg-surface-muted text-text-tertiary" : "bg-primary/10 text-primary",
      )}
      title={label}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const { can, isSuperAdmin, adminRole } = usePermission();
  const { user, logout } = useAuthContext();

  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const asideRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const navGroups = useMemo(() => getNavGroups(can), [can]);
  const counts = useSidebarCounts(can);

  const isActive = useCallback(
    (path: string) => {
      if (location.pathname === path) return true;
      return path === "/admin/blog" && location.pathname.startsWith("/admin/blog/");
    },
    [location.pathname],
  );

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "center" });
    }
  }, [location.pathname, open]);

  useEffect(() => {
    if (window.innerWidth < 1024) onCloseRef.current();
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const node = asideRef.current;
    if (!node) return;

    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden");

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  const badgeFor = (item: NavItem) => (item.badgeKey ? counts[item.badgeKey] ?? 0 : 0);

  const groupBadge = (group: NavGroup) =>
    group.items.reduce((sum, item) => sum + badgeFor(item), 0);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const roleLabel = isSuperAdmin
    ? "Super admin"
    : adminRole?.name
      ? adminRole.name.replace(/_/g, " ")
      : "Admin";

  const itemClasses = (active: boolean) =>
    cn(
      "relative flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors lg:py-2.5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
      active
        ? "bg-primary/10 font-semibold text-primary"
        : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
    );

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const badge = badgeFor(item);
    return (
      <Link
        key={item.path}
        to={item.path}
        ref={active ? (node) => { activeItemRef.current = node; } : undefined}
        data-nav-active={active ? "true" : undefined}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(itemClasses(active), collapsed && "lg:justify-center lg:px-0")}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
        <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{item.label}</span>
        {badge > 0 && (
          <span className={cn(collapsed && "lg:hidden")}>
            <CountBadge value={badge} label={`${badge} pending in ${item.label}`} />
          </span>
        )}
        {collapsed && badge > 0 && (
          <span className="absolute -right-1 -top-1 hidden h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground lg:flex">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const renderCollapsedGroup = (group: NavGroup) => {
    const badge = groupBadge(group);
    const hasActiveChild = group.items.some((item) => isActive(item.path));
    return (
      <DropdownMenu key={group.group}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              hasActiveChild
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
            aria-label={badge > 0 ? `${group.group}, ${badge} pending` : group.group}
            title={group.group}
          >
            {group.icon}
            {badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-60">
          <DropdownMenuLabel>{group.group}</DropdownMenuLabel>
          {group.items.map((item) => {
            const itemBadge = badgeFor(item);
            const active = isActive(item.path);
            return (
              <DropdownMenuItem key={item.path} asChild>
                <Link
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                    active ? "bg-primary/10 font-semibold text-primary" : "text-text-secondary",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {itemBadge > 0 && (
                    <span className="ml-auto">
                      <CountBadge value={itemBadge} label={`${itemBadge} pending in ${item.label}`} />
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar-bg",
          "transition-[width,transform] duration-200 motion-reduce:transition-none",
          collapsed ? "lg:w-[72px]" : "lg:w-[280px]",
          "lg:relative lg:h-full lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar navigation"
        aria-modal={open ? true : undefined}
        role={open ? "dialog" : undefined}
      >
        <div
          className={cn(
            "relative flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <Link
            to="/admin/overview"
            className={cn("flex min-w-0 items-center", collapsed && "lg:hidden")}
            aria-label="Travio Ghana dashboard"
          >
            <img
              src={travioWordmark}
              alt="Travio Ghana"
              className="h-11 w-auto max-w-[180px] object-contain dark:hidden"
            />
            <img
              src={travioWordmarkDark}
              alt=""
              aria-hidden="true"
              className="hidden h-11 w-auto max-w-[180px] object-contain dark:block"
            />
          </Link>

          {collapsed && (
            <Link
              to="/admin/overview"
              className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full lg:flex"
              aria-label="Travio Ghana dashboard"
              title="Travio Ghana"
            >
              <img src={travioBadge} alt="" className="h-9 w-9 object-cover" />
            </Link>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="ml-auto hidden h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary lg:flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="absolute -right-3 top-1/2 z-50 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-base text-text-tertiary shadow-sm transition-colors hover:text-text-primary lg:flex"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary lg:hidden"
            aria-label="Close sidebar"
            data-sidebar-close
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 scrollbar-thin" aria-label="Primary">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className={cn(
              "mb-3 flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-base px-3 text-xs text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label="Jump to a page"
            title={collapsed ? "Jump to a page" : undefined}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>Jump to…</span>
            <kbd className={cn("hidden rounded border border-border bg-surface-muted px-1 py-0.5 text-[10px] text-text-tertiary sm:inline", collapsed && "lg:hidden")}>
              ⌘K
            </kbd>
          </button>

          <div className="space-y-4">
            {navGroups.map((group) => {
              if (group.group === "Overview") {
                return (
                  <div key={group.group} className="space-y-0.5">
                    {group.items.map((item) => renderNavItem(item))}
                  </div>
                );
              }

              return (
                <div key={group.group}>
                  <div className={cn(
                    "px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary",
                    collapsed && "lg:hidden",
                  )}>
                    {group.group}
                  </div>
                  <div className={cn("space-y-0.5", collapsed && "lg:hidden")}>
                    {group.items.map((item) => renderNavItem(item))}
                  </div>
                  {collapsed && (
                    <div className="hidden lg:block">{renderCollapsedGroup(group)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  collapsed && "lg:justify-center lg:px-0",
                )}
                aria-label="Account menu"
                title={collapsed ? "Account" : undefined}
              >
                <span className="relative shrink-0">
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-medium text-primary ring-1 ring-border">
                    <span>
                      {user?.name?.charAt(0)?.toUpperCase() ||
                        user?.email?.charAt(0)?.toUpperCase() ||
                        "A"}
                    </span>
                    {user?.photoURL && (
                      <OptimizedImage
                        src={user.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full rounded-full object-cover"
                        width={40}
                        onError={(event) => { (event.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-bg bg-success" />
                </span>
                <span className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {user?.name || user?.email?.split("@")[0] || "Admin"}
                  </span>
                  <span className="block truncate text-[11px] capitalize text-text-tertiary">{roleLabel}</span>
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-text-tertiary", collapsed && "lg:hidden")} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-64">
              <div className="border-b border-border px-3 pb-3 pt-2">
                <p className="truncate text-sm font-semibold text-text-primary">{user?.name || "Admin"}</p>
                <p className="mt-0.5 truncate text-xs text-text-tertiary">{user?.email || ""}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
                  {roleLabel}
                </span>
              </div>
              <div className="py-1">
                {isSuperAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm">
                      <Settings className="h-4 w-4 text-text-tertiary" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuItem
                  onClick={() => setSignOutOpen(true)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={() => void handleSignOut()}
        title="Sign out of the admin?"
        description="You will need to sign in again to manage Travio Ghana."
        confirmLabel="Sign out"
        confirmVariant="destructive"
        loading={signingOut}
      />

      {open && (
        <div
          className="fixed inset-0 z-30 bg-text-primary/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
