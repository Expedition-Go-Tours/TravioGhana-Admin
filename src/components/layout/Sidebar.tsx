import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import {
  LayoutDashboard,
  TrendingUp,
  Search,
  ShoppingCart,
  Users,
  DollarSign,
  Map,
  UserPlus,
  Banknote,
  Star,
  Building,
  ChevronDown,
  BarChart3,
  UserCog,
  Target,
  MessageSquare,
  Settings,
  X,
  FileText,
  Globe,
  History,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/auth/useAuth";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { getNavGroups, type NavItem } from "@/components/layout/navConfig";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const springEase = [0.32, 0.72, 0, 1] as const;

function useSidebarCounts(can: (key: string) => boolean) {
  const canBookings = can('bookings.view') || can('dashboard.*');
  const canReviews = can('reviews.view');
  const canTours = can('tours.approve') || can('tours.view');

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

  useSocketInvalidate("admin:new-booking", ["admin", "bookings"]);
  useSocketInvalidate("admin:new-review", ["admin", "reviews-pending-count"]);
  useSocketInvalidate("admin:tour-update", ["admin", "tour-review"]);

  return {
    bookings: bookingsQuery.data ?? 0,
    reviews: reviewsQuery.data ?? 0,
    tours: toursQuery.data ?? 0,
  };
}

function CountBadge({ value, collapsed }: { value: number; collapsed?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
        collapsed ? "bg-white/20 text-white" : "bg-white/15 text-white",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [user, setUser] = useState<{ name?: string; email?: string; photoURL?: string } | null>(null);
  const location = useLocation();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const { can, isSuperAdmin } = usePermission();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("admin-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["Revenue", "Users"]);
  const navGroups = getNavGroups(can);
  const counts = useSidebarCounts(can);
  const adminGroups: { group: string; items: NavItem[] }[] = isSuperAdmin ? [{
    group: "Administration",
    items: [
      { label: "Activity Log", path: "/admin/activity-log", icon: <History className="h-4 w-4" /> },
      { label: "Settings", path: "/admin/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  }] : [];

  useEffect(() => {
    try { localStorage.setItem("admin-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    api.get("/admin/me").then((res) => {
      const u = res.data?.data;
      if (u) setUser({ name: u.name, email: u.email, photoURL: u.photoURL });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) onCloseRef.current();
  }, [location.pathname]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
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

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label],
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (location.pathname === path) return true;
    if (path === "/admin/blog" && location.pathname.startsWith("/admin/blog/")) return true;
    return false;
  };

  const isChildActive = (children?: { path: string }[]) => {
    return children?.some((c) => location.pathname === c.path) ?? false;
  };

  const badgeFor = (key?: NavItem["badgeKey"]) => {
    if (!key) return 0;
    return counts[key];
  };

  const handleSignOut = () => {
    setSigningOut(true);
    setTimeout(() => {
      void logout();
    }, 1200);
  };

  const itemClasses = (active: boolean, collapsed: boolean) =>
    cn(
      "relative flex items-center gap-3 rounded-lg text-sm transition-all duration-200",
      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
      active
        ? "bg-white/15 text-white font-semibold shadow-[inset_4px_0_0_0_white]"
        : "text-white/65 hover:bg-white/10 hover:text-white",
    );

  const childClasses = (active: boolean) =>
    cn(
      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
      active
        ? "bg-white/15 text-white font-semibold"
        : "text-white/55 hover:bg-white/10 hover:text-white",
    );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar-bg",
          collapsed ? "w-[76px]" : "w-[280px]",
          "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] lg:relative lg:translate-x-0 lg:h-full lg:transition-[width]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar navigation"
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "lg:px-0")}>
          <Link
            to="/admin/overview"
            className={cn("flex items-center overflow-hidden", collapsed && "hidden")}
            aria-label="Dashboard"
          >
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              Travio Ghana Admin
            </span>
          </Link>
          <div className={cn("flex items-center gap-1", collapsed ? "mx-auto" : "ml-auto")}>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-none px-2 py-3" role="navigation">
          {[...navGroups, ...adminGroups].map((group) => (
            <div key={group.group} className="mb-4">
              <div className={cn("px-3 py-2", collapsed && "lg:px-0 lg:py-2")}>
                {collapsed ? (
                  <span className="mx-auto hidden h-px w-6 bg-white/20 lg:block" />
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    {group.group}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  if (item.children) {
                    const isOpen = expandedMenus.includes(item.label) || isChildActive(item.children);
                    const childActive = isChildActive(item.children);
                    if (collapsed) {
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            setCollapsed(false);
                            toggleMenu(item.label);
                          }}
                          className={cn(
                            "mx-auto flex w-12 items-center justify-center rounded-lg py-2.5 transition-all duration-200",
                            childActive ? "text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
                          )}
                          aria-label={item.label}
                          title={item.label}
                        >
                          {item.icon}
                        </button>
                      );
                    }
                    return (
                      <div key={item.label}>
                        <button
                          onClick={() => toggleMenu(item.label)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                            childActive
                              ? "bg-white/15 text-white font-medium"
                              : "text-white/65 hover:bg-white/10 hover:text-white",
                          )}
                          aria-expanded={isOpen}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          <motion.span
                            animate={{ rotate: isOpen ? 0 : -90 }}
                            transition={{ duration: 0.2, ease: springEase }}
                            className="shrink-0"
                          >
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </motion.span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: springEase }}
                              className="overflow-hidden"
                            >
                              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/20 pl-2">
                                {item.children.map((child) => (
                                  <Link
                                    key={child.path}
                                    to={child.path}
                                    className={childClasses(location.pathname === child.path)}
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/50">
                                      {child.icon}
                                    </span>
                                    <span className="truncate">{child.label}</span>
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  const active = isActive(item.path);
                  const badge = badgeFor(item.badgeKey);
                  return (
                    <Link
                      key={item.path}
                      to={item.path!}
                      className={cn(
                        itemClasses(active, collapsed),
                        collapsed && "relative mx-auto w-12",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                        {item.icon}
                        {collapsed && badge > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold text-white">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {badge > 0 && <CountBadge value={badge} />}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors", !collapsed && "hover:bg-white/10")}>
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-semibold text-white ring-2 ring-white/20">
                <span>{user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "A"}</span>
                {user?.photoURL && (
                  <OptimizedImage
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                    width={40}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-bg bg-white" />
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {user?.name || user?.email?.split("@")[0] || "Admin"}
                  </p>
                  <p className="truncate text-xs text-white/50">
                    {user?.email || ""}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  {isSuperAdmin && (
                    <Link
                      to="/admin/settings"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Settings"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-400"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}