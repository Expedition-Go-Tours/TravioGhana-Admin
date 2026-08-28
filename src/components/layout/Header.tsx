import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Loader2, Settings, UserCircle, Menu, ChevronRight, Sun, Moon } from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { SearchDropdown } from "./SearchDropdown";
import { useAuth } from "@/auth/useAuth";
import { isSuperAdmin, hasPermission } from "@/hooks/usePermission";
import { useTheme } from "@/hooks/useTheme";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";

const breadcrumbMap: Record<string, string> = {
  overview: "Overview",
  "revenue-trend": "Revenue Trend",
  "search-analytics": "Search Analytics",
  "cart-abandonment": "Cart Abandonment",
  "user-growth": "User Growth",
  clv: "Customer Lifetime Value",
  funnel: "Conversion Funnel",
  tours: "Tour Performance",
  "tour-moderation": "Tour Moderation",
  suppliers: "Suppliers",
  payouts: "Payouts",
  reviews: "Review Moderation",
  chat: "Messages",
  bookings: "Bookings",
  settings: "Settings",
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const segments = location.pathname.split("/").filter(Boolean);
  const superAdmin = isSuperAdmin();

  const isTourDetail = segments[1] === "tours" && segments.length === 3 && !!segments[2];
  const tourId = isTourDetail ? segments[2] : null;

  const isSupplierDetail = segments[1] === "suppliers" && segments.length === 3 && !!segments[2];
  const supplierId = isSupplierDetail ? segments[2] : null;

  const { data: tourTitle } = useQuery({
    queryKey: ["admin", "tour-title", tourId],
    queryFn: async () => {
      const res = await api.get(`/admin/tours/${tourId}`);
      const body = res.data as { data?: { tour?: { title?: unknown } }; tour?: { title?: unknown } };
      const t = body?.data?.tour ?? body?.tour ?? (body as Record<string, unknown>);
      const title = typeof t === "object" && t !== null && "title" in t ? (t as { title?: unknown }).title : undefined;
      return typeof title === "string" && title ? title : null;
    },
    enabled: isTourDetail,
  });

  const { data: supplierName } = useQuery({
    queryKey: ["admin", "supplier-name", supplierId],
    queryFn: async () => {
      const res = await api.get(`/suppliers/admin/${supplierId}/profile`);
      const body = res.data as { data?: { supplier?: { name?: unknown } } };
      const name = body?.data?.supplier?.name;
      return typeof name === "string" && name ? name : null;
    },
    enabled: isSupplierDetail,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = useCallback(() => {
    setSigningOut(true);
    setTimeout(() => {
      logout();
    }, 2000);
  }, [logout]);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-surface-base/80 px-3 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted transition-colors lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <SearchDropdown />

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm text-text-secondary min-w-0">
          <Link to="/admin/overview" className="shrink-0 hover:text-text-primary transition-colors">
            Home
          </Link>
          {segments.slice(1).map((seg, idx) => {
            const label = breadcrumbMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
            const isLast = idx === segments.slice(1).length - 1;
            const displayLabel = isLast ? (isTourDetail ? tourTitle || tourId : isSupplierDetail ? supplierName || supplierId : label) : label;
            return (
              <span key={seg} className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3 w-3 shrink-0 text-text-tertiary" />
                <span className={cn(
                  "truncate",
                  isLast ? "text-text-primary font-medium" : "text-text-secondary"
                )}>
                  {displayLabel}
                </span>
              </span>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {hasPermission('notifications.view') && <NotificationBell />}
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted transition-colors"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-muted transition-all duration-200"
          >
            <UserCircle className="h-5 w-5" />
            <span className="hidden md:inline">Admin</span>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-surface-base shadow-soft-lg py-1 z-50 overflow-hidden"
              >
                {superAdmin && (
                  <button
                    onClick={() => { navigate("/admin/settings"); setMenuOpen(false); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    <Settings className="h-4 w-4 text-text-tertiary" /> Settings
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  {signingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  {signingOut ? "Signing out..." : "Sign Out"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
