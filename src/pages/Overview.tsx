import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import {
  Users,
  MessageSquare,
  Building,
  Activity,
  ArrowRight,
  X,
  MessageCircle,
  Map,
  MapPin,
  Star as StarIcon,
  Banknote,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  UserCheck,
} from "lucide-react";
import {
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { BookingVolumeChart } from "./overview/BookingVolumeChart";
import { RecentActivityPanel } from "./overview/RecentActivityPanel";
import { TopSuppliers } from "./overview/TopSuppliers";
import { NotificationsCard } from "./overview/NotificationsCard";
import { getNotificationStats, NOTIFICATION_OVERVIEW_ROOT } from "@/services/notificationService";
import { RecentBookingsTable } from "./overview/RecentBookingsTable";
import styles from "./Overview.module.css";
import api from "@/lib/axios";
import { getAdminSocket } from "@/lib/adminSocket";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface OverviewData {
  forbidden?: boolean;
  revenue?: { today?: { revenue?: number }; yesterday?: { revenue?: number }; thisWeek?: { revenue?: number; commission?: number; supplierPayout?: number }; thisMonth?: { revenue?: number; commission?: number; supplierPayout?: number }; ytd?: { revenue?: number; commission?: number; supplierPayout?: number } };
  bookings?: { today?: number; yesterday?: number; thisWeek?: number; thisMonth?: number; ytd?: number };
  signups?: { today?: number; yesterday?: number };
  activeUsers?: number;
  activeUsersPrevious?: number;
  topTours?: Array<{ id?: string; title?: string; coverPhoto?: string; bookingCount?: number; revenue?: number; currency?: string; averageRating?: number; reviewCount?: number }>;
  topSuppliers?: Array<{ id?: string; user?: { name?: string; email?: string; photoURL?: string }; totalEarnings?: number; totalBookings?: number; averageRating?: number }>;
  weeklyBookingData?: Array<{ day: string; count: number }>;
  bookingStatusDistribution?: Array<{ status?: string; count?: number }>;
}

const statusLabel = (status?: string | null) => {
  if (!status) return "Unknown";
  const label = status.toLowerCase().replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const bookingColors: Record<string, string> = {
  CONFIRMED: "hsl(var(--status-active))",
  PENDING: "hsl(var(--status-pending))",
  CANCELLED: "hsl(var(--status-rejected))",
  REFUNDED: "hsl(var(--status-flagged))",
  COMPLETED: "hsl(var(--status-approved))",
  NO_SHOW: "hsl(var(--status-suspended))",
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [timeFilter, setTimeFilter] = useState("this_month");

  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [showTodayBookings, setShowTodayBookings] = useState(false);
  const [showNewSignups, setShowNewSignups] = useState(false);

  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: overviewRefetch } = useQuery({
    queryKey: ["admin", "overview", timeFilter],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/analytics/overview", {
        params: { period: timeFilter, tzOffsetMinutes: new Date().getTimezoneOffset() },
      });
        const d = res.data?.data as Record<string, unknown> | undefined;
        const overview = (d?.overview as Record<string, unknown>) || {};
        return {
          revenue: (overview?.revenue as Record<string, unknown>) || {},
          bookings: (overview?.bookings as Record<string, unknown>) || {},
          signups: (overview?.signups as Record<string, unknown>) || {},
          activeUsers: (overview?.activeUsers as number) || 0,
          activeUsersPrevious: (overview?.activeUsersPrevious as number) || 0,
          topTours: ((d?.topTours as Array<Record<string, unknown>>) || []).map((t) => ({
            id: t.id as string,
            title: t.title as string,
            coverPhoto: t.coverPhoto as string,
            bookingCount: (t.totalBookings as number) || 0,
            revenue: (t.totalRevenue as number) || 0,
            currency: (t.currency as string) || "USD",
            averageRating: (t.averageRating as number) || 0,
            reviewCount: (t.reviewCount as number) || 0,
          })),
          topSuppliers: ((d?.topSuppliers as Array<Record<string, unknown>>) || []).map((s) => ({
            id: s.id as string,
            user: { name: s.name as string, email: s.email as string, photoURL: s.photoURL as string },
            totalEarnings: (s.totalEarnings as number) || 0,
            currency: (s.currency as string) || "USD",
            totalBookings: (s.totalBookings as number) || 0,
            averageRating: (s.averageRating as number) || 0,
          })),
          weeklyBookingData: (d?.weeklyBookingData as Array<{ day: string; count: number }>) || [],
          bookingStatusDistribution: (d?.bookingStatusDistribution as Array<Record<string, unknown>>) || [],
        } as OverviewData;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "response" in err) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr.response?.status === 403) {
            return { forbidden: true } as OverviewData;
          }
        }
        throw err;
      }
    },
    placeholderData: keepPreviousData,
  });

  const { data: payoutSummary, isLoading: payoutLoading, isError: payoutError, refetch: payoutRefetch } = useQuery({
    queryKey: ["admin", "payout-summary"],
    enabled: can('payouts.view'),
    queryFn: async () => {
      const res = await api.get("/payouts/admin/summary", {
        params: { tzOffsetMinutes: new Date().getTimezoneOffset() },
      });
      const d = res.data?.data as {
        pending?: { count: number; total: number };
        paidThisMonth?: { count: number; total: string };
        outstanding?: { count: number; total: number };
      } | undefined;
      return {
        pending: { count: d?.pending?.count ?? 0, totalAmount: d?.pending?.total ?? 0 },
        paidThisMonth: { count: d?.paidThisMonth?.count ?? 0, totalAmount: d?.paidThisMonth?.total ?? "0" },
        outstanding: { count: d?.outstanding?.count ?? 0, totalAmount: d?.outstanding?.total ?? 0 },
      };
    },
  });





  const { data: activeUsersData, isLoading: activeUsersLoading } = useQuery({
    queryKey: ["admin", "active-users", timeFilter],
    queryFn: async () => {
      // Same window as the tile that opened this: the count and the list must
      // answer the same question, and "active" means activity here, not the
      // timestamp of someone's most recent login.
      const res = await api.get(`/admin/users/active?period=${encodeURIComponent(timeFilter)}`);
      return (res.data?.data?.users || []) as Array<{ id: string; name: string; email: string; photoURL?: string; roles?: string[]; lastLoginAt?: string; lastActiveAt?: string }>;
    },
    enabled: showActiveUsers,
  });

  const { data: todayBookings, isLoading: todayBookingsLoading } = useQuery({
    queryKey: ["admin", "bookings", "today"],
    queryFn: async () => {
      const res = await api.get("/admin/bookings/today");
      return (res.data?.data?.bookings || []) as Array<{
        id: string;
        bookingNumber: string;
        status: string;
        grossAmount: number;
        currency: string;
        createdAt: string;
        customer: { id: string; name: string; email: string } | null;
        // Present on every row (the endpoint includes all scalars); a guest
        // booking has no customer, and this is who it is for instead.
        leadTravelerName?: string | null;
        tour: { id: string; title: string; supplier: { id: string; name: string } };
      }>;
    },
    enabled: showTodayBookings,
  });

  const { data: newSignupsData, isLoading: newSignupsLoading } = useQuery({
    queryKey: ["admin", "users", "new-signups"],
    queryFn: async () => {
      const res = await api.get("/admin/users/new-signups");
      return (res.data?.data?.users || []) as Array<{ id: string; name: string; email: string; photoURL?: string; roles?: string[]; createdAt?: string }>;
    },
    enabled: showNewSignups,
  });


  // Recent Bookings
  const { data: recentBookings, isLoading: recentBookingsLoading, isError: recentBookingsError, refetch: recentBookingsRefetch } = useQuery({
    queryKey: ["admin", "bookings", "recent"],
    queryFn: async () => {
      const res = await api.get("/admin/bookings?limit=5&sortOrder=desc");
      return (res.data?.data?.bookings || []) as Array<{
        id: string;
        bookingNumber: string;
        status: string;
        grossAmount: number;
        currency: string;
        createdAt: string;
        customer: { name: string; email: string; photoURL?: string };
        tour: { title: string };
      }>;
    },
  });

  // Notification Stats
  const { data: notifStats, isLoading: notifStatsLoading, isError: notifStatsError, refetch: notifStatsRefetch } = useQuery({
    queryKey: NOTIFICATION_OVERVIEW_ROOT,
    // Totals per queue for the four tiles; the red badge above them carries
    // what is still unread, and "Done" acknowledges exactly that. Showing only
    // the pending subset made the card read "0 0 0 0 — all clear" while the
    // dashboard still had notifications, which looks like a broken card.
    queryFn: () => getNotificationStats(),
    enabled: can("notifications.view"),
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getAdminSocket();
    const refetchOverview = () => queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    const refetchSignups = () => queryClient.invalidateQueries({ queryKey: ["admin", "users", "new-signups"] });
    const refetchTodayBookings = () => queryClient.invalidateQueries({ queryKey: ["admin", "bookings", "today"] });
    const refetchRevenueTrend = () => queryClient.invalidateQueries({ queryKey: ["admin", "revenue-trend"] });
    const refetchNotifStats = () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_OVERVIEW_ROOT });
    const onBooking = () => { refetchOverview(); refetchTodayBookings(); refetchRevenueTrend(); refetchNotifStats(); };
    const onSignup = () => { refetchSignups(); refetchOverview(); };
    const onTourChange = () => refetchOverview();
    const onSupplierApp = () => { refetchOverview(); refetchNotifStats(); };
    const onSupplierStatus = () => { refetchOverview(); refetchNotifStats(); };
    const onPayout = () => { refetchNotifStats(); refetchRevenueTrend(); };
    const onReview = () => { refetchOverview(); refetchNotifStats(); };
    socket.on("admin:signup", onSignup);
    socket.on("admin:new-booking", onBooking);
    socket.on("admin:new-review", onReview);
    socket.on("admin:new-tour", onTourChange);
    socket.on("admin:tour-update", onTourChange);
    socket.on("admin:supplier-application", onSupplierApp);
    socket.on("admin:supplier-status-change", onSupplierStatus);
    socket.on("admin:payout-update", onPayout);
    socket.on("admin-notification", refetchNotifStats);
    socket.on("admin:notification", refetchNotifStats);
    return () => {
      socket.off("admin:signup", onSignup);
      socket.off("admin:new-booking", onBooking);
      socket.off("admin:new-review", onReview);
      socket.off("admin:tour-update", onTourChange);
      socket.off("admin:supplier-application", onSupplierApp);
      socket.off("admin:supplier-status-change", onSupplierStatus);
      socket.off("admin:payout-update", onPayout);
      socket.off("admin-notification", refetchNotifStats);
      socket.off("admin:notification", refetchNotifStats);
    };
  }, [queryClient]);

  const calcTrend = (
    current: number | undefined | null,
    previous: number | undefined | null,
  ): { value: number; isPositive: boolean; raw?: number } | undefined => {
    const cur = Number(current) || 0;
    if (cur === 0) return undefined;
    const prev = Number(previous) || 0;
    if (prev === 0) return undefined;
    const change = ((cur - prev) / prev) * 100;
    const raw = Math.abs(Math.round(change));
    // Growth is a badge, not a ledger. Read next to an 83% card, "1,500%"
    // looks like a broken number rather than "very up", so the badge stops at
    // 100% (shown as "100%+") and the exact figure moves to the tooltip.
    return { value: Math.min(raw, 100), isPositive: change >= 0, raw };
  };

  // Only real multi-point history is rendered as a sparkline. A single point
  // produced a meaningless dot next to the KPI value.
  const weeklyBookingData = overview?.weeklyBookingData || [];
  const bookingsSparkline = weeklyBookingData.slice(-7).map((d) => d.count);
  const weeklyTotal = weeklyBookingData.reduce((sum, d) => sum + d.count, 0);

  // Current vs previous period, both of which the API computes for the
  // selected range. Splitting the series in half was not a previous-period
  // comparison and changed meaning with the filter.
  const weeklyTrend = calcTrend(overview?.bookings?.today, overview?.bookings?.yesterday);

  const userName = localStorage.getItem("userName") || "Admin";
  const periodShort =
    timeFilter === "last_month" ? "Last month"
    : timeFilter === "last_quarter" ? "Last quarter"
    : timeFilter === "today" ? "Today"
    : "This month";

  const comparisonLabel =
    timeFilter === "today" ? "vs yesterday"
    : timeFilter === "this_month" ? "vs last month"
    : timeFilter === "last_month" ? "vs previous month"
    : "vs previous quarter";

  return (
    <div 
      className="space-y-4 md:space-y-5">
      {overview?.forbidden ? (
        <WelcomeDashboard />
      ) : (
        <>
          {/* Welcome Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-text-primary">
                Hello, {userName}
              </h1>
              <p className="mt-1 text-sm text-text-tertiary">
                Here are the latest insights from your customer interactions.
              </p>
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs" aria-label="Time period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last_quarter">Last quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {overviewError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-rejected/30 bg-status-rejected/5 px-4 py-3">
              <p className="text-sm text-status-rejected-text">
                Dashboard metrics could not be loaded. The figures below are unavailable.
              </p>
              <Button variant="outline" size="sm" onClick={() => overviewRefetch()}>
                Retry
              </Button>
            </div>
          )}

          {/* KPI Cards with Sparklines */}
          <div  className={styles.kpiGrid}>
            {can('dashboard.bookings') && (
              <KPICardWithSparkline
                label="Bookings"
                value={overviewLoading ? 0 : Number(overview?.bookings?.today) || 0}
                trend={calcTrend(overview?.bookings?.today, overview?.bookings?.yesterday)}
                sparklineData={bookingsSparkline}
                sparklineColor="hsl(var(--status-active))"
                loading={overviewLoading}
                error={overviewError}
                onClick={() => setShowTodayBookings(true)}
                trendLabel={comparisonLabel}
                accent="emerald"
                icon={<ShoppingCart className="h-4 w-4" />}
              />
            )}
            {can('dashboard.revenue') && (
              <KPICardWithSparkline
                label="Revenue"
                value={overviewLoading ? 0 : Number(overview?.revenue?.today?.revenue) || 0}
                trend={calcTrend(
                  overview?.revenue?.today?.revenue ? Number(overview.revenue.today.revenue) : undefined,
                  overview?.revenue?.yesterday?.revenue ? Number(overview.revenue.yesterday.revenue) : undefined
                )}
                loading={overviewLoading}
                error={overviewError}
                onClick={() => navigate("/admin/revenue-trend")}
                trendLabel={comparisonLabel}
                format="currency"
                accent="blue"
                icon={<Banknote className="h-4 w-4" />}
              />
            )}
            {can('users.view') && (
              <KPICardWithSparkline
                label="Active Users"
                value={overviewLoading ? 0 : Number(overview?.activeUsers) || 0}
                trend={calcTrend(overview?.activeUsers, overview?.activeUsersPrevious)}
                loading={overviewLoading}
                error={overviewError}
                onClick={() => setShowActiveUsers(true)}
                trendLabel={comparisonLabel}
                accent="violet"
                icon={<UserCheck className="h-4 w-4" />}
              />
            )}
          </div>

          {/* Booking Volume + Recent Activity */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <BookingVolumeChart
                data={weeklyBookingData}
                total={weeklyTotal}
                trend={weeklyTrend}
                loading={overviewLoading}
                period={timeFilter}
              />
            </div>
            <div className="xl:col-span-1">
              <RecentActivityPanel />
            </div>
          </div>

          {/* Top Suppliers + Notifications + Recent Bookings */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="lg:col-span-1">
              <TopSuppliers 
                suppliers={overview?.topSuppliers} 
                loading={overviewLoading} 
              />
            </div>
            <div className="lg:col-span-1">
              <NotificationsCard
                data={notifStats}
                loading={notifStatsLoading}
                error={notifStatsError}
                onRetry={() => notifStatsRefetch()}
              />
            </div>
            <div className="md:col-span-2 xl:col-span-1">
              <RecentBookingsTable
                bookings={recentBookings}
                loading={recentBookingsLoading}
                error={recentBookingsError}
                onRetry={() => recentBookingsRefetch()}
              />
            </div>
          </div>

          {/* Top Tours */}
          {can('tours.view') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-6 py-4">
                <CardTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.01em] text-text-primary">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Map className="h-4 w-4" />
                  </span>
                  Top Tours
                  <span className="text-[11px] font-semibold text-text-tertiary">{periodShort}</span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => navigate("/admin/tours")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </button>
              </CardHeader>
              <CardContent className="p-0">
                {overviewLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                  </div>
                ) : overviewError ? (
                  <SectionError message="Failed to load tours" onRetry={() => overviewRefetch()} />
                ) : !overview?.topTours?.length ? (
                  <SectionEmpty message="No top tours data for this period" />
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[640px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th scope="col" className="w-12 px-6 py-2.5 text-left text-[11px] font-semibold text-text-tertiary">#</th>
                            <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-semibold text-text-tertiary">Tour</th>
                            <th scope="col" className="w-28 px-3 py-2.5 text-right text-[11px] font-semibold text-text-tertiary">Bookings</th>
                            <th scope="col" className="w-36 px-3 py-2.5 text-right text-[11px] font-semibold text-text-tertiary">Revenue</th>
                            <th scope="col" className="w-36 px-6 py-2.5 text-right text-[11px] font-semibold text-text-tertiary">Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.topTours.map((tour, idx) => {
                            const rating = Number(tour.averageRating) || 0;
                            const reviews = Number(tour.reviewCount) || 0;
                            const go = () => navigate(tour.id ? `/admin/tours/${tour.id}` : "/admin/tours");
                            return (
                              <tr
                                key={tour.id || idx}
                                role="link"
                                tabIndex={0}
                                onClick={go}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    go();
                                  }
                                }}
                                className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                              >
                                <td className="px-6 py-3">
                                  <span className={cn(
                                    "tnum inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                                    idx < 3 ? "bg-primary/10 text-primary" : "text-text-tertiary",
                                  )}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    {tour.coverPhoto ? (
                                      <OptimizedImage src={tour.coverPhoto} alt="" width={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                    ) : (
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                                        <MapPin className="h-4 w-4 text-text-tertiary" />
                                      </div>
                                    )}
                                    <p className="truncate font-medium text-text-primary">{tour.title}</p>
                                  </div>
                                </td>
                                <td className="tnum px-3 py-3 text-right text-text-secondary">{formatNumber(tour.bookingCount)}</td>
                                <td className="tnum px-3 py-3 text-right font-semibold text-text-primary">{formatCurrency(tour.revenue, tour.currency)}</td>
                                <td className="px-6 py-3 text-right">
                                  {rating > 0 ? (
                                    <span className="inline-flex items-center justify-end gap-1 text-text-secondary">
                                      <StarIcon className="h-3.5 w-3.5 fill-status-pending text-status-pending-text" />
                                      <span className="tnum font-semibold text-text-primary">{rating.toFixed(1)}</span>
                                      <span className="tnum text-[11px] text-text-tertiary">({formatNumber(reviews)})</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-text-tertiary">No reviews</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile list */}
                    <div className="divide-y divide-border md:hidden">
                      {overview.topTours.map((tour, idx) => {
                        const rating = Number(tour.averageRating) || 0;
                        return (
                          <button
                            key={tour.id || idx}
                            type="button"
                            onClick={() => navigate(tour.id ? `/admin/tours/${tour.id}` : "/admin/tours")}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                          >
                            <span className={cn(
                              "tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                              idx < 3 ? "bg-primary/10 text-primary" : "text-text-tertiary",
                            )}>
                              {idx + 1}
                            </span>
                            {tour.coverPhoto ? (
                              <OptimizedImage src={tour.coverPhoto} alt="" width={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                                <MapPin className="h-4 w-4 text-text-tertiary" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">{tour.title}</p>
                                <span className="tnum shrink-0 text-sm font-semibold text-text-primary">
                                  {formatCurrency(tour.revenue, tour.currency)}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-text-tertiary">
                                <span className="tnum">{formatNumber(tour.bookingCount)} bookings</span>
                                <span aria-hidden="true">·</span>
                                {rating > 0 ? (
                                  <span className="tnum inline-flex items-center gap-0.5">
                                    <StarIcon className="h-3 w-3 fill-status-pending text-status-pending-text" />
                                    {rating.toFixed(1)}
                                  </span>
                                ) : (
                                  <span>No reviews</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bottom Grid: Booking Status + Payout Summary */}
          {(can('dashboard.bookings') || can('dashboard.*') || can('payouts.view')) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {can('dashboard.bookings') && (
                <Card>
                  <CardHeader className="border-b border-border pb-3.5">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.01em] text-text-primary">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-approved/10 text-status-approved-text">
                        <Activity className="h-4 w-4" />
                      </span>
                      Booking Status
                      <span className="ml-auto text-[11px] font-semibold text-text-tertiary">All time</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {overviewLoading ? (
                      <Skeleton className="h-48 w-full rounded-xl" />
                    ) : overviewError ? (
                      <SectionError message="Failed to load booking status" onRetry={() => overviewRefetch()} />
                    ) : !overview?.bookingStatusDistribution?.length ? (
                      <SectionEmpty message="No booking data" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="relative w-full">
                          <div className={styles.chartPie}>
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <Pie
                                  data={(overview.bookingStatusDistribution || []).map((d) => ({ name: d.status || "Unknown", value: d.count || 0 }))}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={85}
                                  dataKey="value"
                                  paddingAngle={3}
                                  stroke="none"
                                >
                                  {(overview.bookingStatusDistribution || []).map((entry, i) => (
                                    <Cell key={entry.status || `unknown-${i}`} fill={bookingColors[entry.status || ""] || "hsl(var(--status-suspended))"} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [formatNumber(Number(value)), statusLabel(String(name))]} />
                              </RePieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="tnum text-2xl font-semibold leading-none tracking-[-0.02em] text-text-primary">
                              {formatNumber((overview.bookingStatusDistribution || []).reduce((sum, d) => sum + (d.count || 0), 0))}
                            </span>
                            <span className="mt-1 text-[11px] text-text-tertiary">bookings</span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                          {(overview.bookingStatusDistribution || []).map((d, i) => (
                            <span key={d.status || `legend-${i}`} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bookingColors[d.status || ""] || "hsl(var(--status-suspended))" }} />
                              {statusLabel(d.status)} <span className="tnum text-text-tertiary">{formatNumber(d.count || 0)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {can('payouts.view') && (
                <Card>
                  <CardHeader className="border-b border-border pb-3.5">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.01em] text-text-primary">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary">
                        <Banknote className="h-4 w-4" />
                      </span>
                      Payout Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {payoutError ? (
                      <SectionError message="Failed to load payout summary" onRetry={() => payoutRefetch()} />
                    ) : payoutLoading || !payoutSummary ? (
                      <Skeleton className="h-28 w-full rounded-xl" />
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-2.5 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-status-rejected" />
                            <span className="text-sm text-text-secondary">Outstanding</span>
                          </div>
                          <span className="tnum text-sm font-semibold text-status-rejected-text">{formatNumber(payoutSummary.outstanding?.count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-status-pending" />
                            <span className="text-sm text-text-secondary">Pending</span>
                          </div>
                          <span className="tnum text-sm font-semibold text-status-pending-text">{formatNumber(payoutSummary.pending?.count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-sm text-text-secondary">Paid This Month</span>
                          </div>
                          <span className="tnum text-sm font-semibold text-primary">{formatNumber(payoutSummary.paidThisMonth?.count)}</span>
                        </div>
                        <div className="text-xs text-text-tertiary space-y-1.5 pt-1">
                          <div className="flex justify-between"><span>Outstanding total</span><span className="tnum font-semibold text-status-rejected-text">{formatCurrency(payoutSummary.outstanding?.totalAmount)}</span></div>
                          <div className="flex justify-between"><span>Pending total</span><span className="tnum font-semibold text-status-pending-text">{formatCurrency(payoutSummary.pending?.totalAmount)}</span></div>
                          <div className="flex justify-between"><span>Paid total</span><span className="tnum font-semibold text-primary">{formatCurrency(payoutSummary.paidThisMonth?.totalAmount)}</span></div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full font-medium" onClick={() => navigate("/admin/payouts")}>
                          View All Payouts
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Dialogs */}
          {showActiveUsers && (
            <ModalShell title={`Active Users (${periodShort})`} onClose={() => setShowActiveUsers(false)}>
              {activeUsersLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : !activeUsersData?.length ? (
                <div className="py-12 text-center text-sm text-text-tertiary">No active users in this period</div>
              ) : (
                <div className="divide-y divide-border">
                  {activeUsersData.map((user) => (
                    <div key={user.id} className="flex items-start gap-3 px-4 py-3">
                      {user.photoURL ? (
                        <OptimizedImage src={user.photoURL} alt="" width={32} className="h-8 w-8 shrink-0 rounded-xl object-cover mt-0.5" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xs font-medium text-text-secondary mt-0.5">
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{user.name || "Unknown"}</p>
                        <p className="text-xs text-text-tertiary truncate">{user.email || "—"}</p>
                      </div>
                      {(user.lastActiveAt || user.lastLoginAt) && (
                        <span className="shrink-0 text-xs text-text-tertiary whitespace-nowrap pt-1">{formatDate(user.lastActiveAt || user.lastLoginAt!)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ModalShell>
          )}

          {showTodayBookings && (
            <ModalShell title="Today's Bookings" onClose={() => setShowTodayBookings(false)} wide>
              {todayBookingsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : !todayBookings?.length ? (
                <div className="py-12 text-center text-sm text-text-tertiary">No bookings today</div>
              ) : (
                <div className="divide-y divide-border">
                  {todayBookings.map((booking) => (
                    <div key={booking.id} className="px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <p className="text-sm text-text-primary truncate">
                            {booking.customer?.name || booking.leadTravelerName || "Unknown"}
                          </p>
                          <p className="text-xs text-text-tertiary truncate">{booking.bookingNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-text-primary truncate">{booking.tour?.title || "—"}</p>
                          <p className="text-xs text-text-tertiary truncate">{booking.tour?.supplier?.name || "—"}</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm text-text-primary">{formatCurrency(booking.grossAmount, booking.currency)}</p>
                          <p className="text-xs text-text-tertiary mt-0.5">{booking.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalShell>
          )}

          {showNewSignups && (
            <ModalShell title="New Signups (Today)" onClose={() => setShowNewSignups(false)}>
              {newSignupsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : !newSignupsData?.length ? (
                <div className="py-12 text-center text-sm text-text-tertiary">No new signups today</div>
              ) : (
                <div className="divide-y divide-border">
                  {newSignupsData.map((user) => (
                    <div key={user.id} className="flex items-start gap-3 px-4 py-3">
                      {user.photoURL ? (
                        <OptimizedImage src={user.photoURL} alt="" width={32} className="h-8 w-8 shrink-0 rounded-xl object-cover mt-0.5" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xs font-medium text-text-secondary mt-0.5">
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{user.name || "Unknown"}</p>
                        <p className="text-xs text-text-tertiary truncate">{user.email || "—"}</p>
                      </div>
                      {user.createdAt && (
                        <span className="shrink-0 text-xs text-text-tertiary whitespace-nowrap pt-1">{formatDate(user.createdAt)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ModalShell>
          )}
        </>
      )}
    </div>
  );
}

/* Modal Shell */
function ModalShell({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40  p-0 sm:p-4" onClick={onClose}>
      <div 
        className={cn(
          "relative w-full sm:rounded-xl bg-surface-base border border-border shadow-lg overflow-hidden",
          "max-h-[85dvh] flex flex-col",
          wide ? "max-w-2xl" : "max-w-lg",
          "rounded-t-xl sm:rounded-xl"
        )}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

/* Welcome Dashboard */
function WelcomeDashboard() {
  const navigate = useNavigate();
  const { can, adminRole } = usePermission();

  const sections = [
    { permission: 'chat.customers', label: 'Customer Support', icon: <MessageCircle className="h-6 w-6" />, route: '/admin/chat/customers', desc: 'Respond to customer inquiries' },
    { permission: 'chat.suppliers', label: 'Supplier Messages', icon: <MessageSquare className="h-6 w-6" />, route: '/admin/chat/suppliers', desc: 'Communicate with suppliers' },
    { permission: 'reviews.view', label: 'Review Moderation', icon: <StarIcon className="h-6 w-6" />, route: '/admin/reviews', desc: 'Approve or flag reviews' },
    { permission: 'suppliers.view', label: 'Suppliers', icon: <Building className="h-6 w-6" />, route: '/admin/suppliers', desc: 'Manage supplier applications' },
    { permission: 'payouts.view', label: 'Payouts', icon: <Banknote className="h-6 w-6" />, route: '/admin/payouts', desc: 'View and approve payouts' },
    { permission: 'tours.view', label: 'Tours', icon: <Map className="h-6 w-6" />, route: '/admin/tours', desc: 'Browse tour performance' },
    { permission: 'users.view', label: 'Users', icon: <Users className="h-6 w-6" />, route: '/admin/user-growth', desc: 'User growth and analytics' },
    { permission: 'settings.access', label: 'Settings', icon: <Settings className="h-6 w-6" />, route: '/admin/settings', desc: 'Configure platform settings' },
  ];

  const available = sections.filter((s) => can(s.permission));

  return (
    <div  className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-text-primary">
          Welcome{adminRole?.name ? `, ${adminRole.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}` : ''}
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">Select a section below to get started</p>
      </div>
      {available.length > 0 ? (
        <div  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {available.map((section) => (
            <button
              key={section.route}
              onClick={() => navigate(section.route)}
              className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-surface-base p-5 text-left transition-colors hover:border-primary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                {section.icon}
              </div>
              <div>
                <p className="font-medium text-text-primary">{section.label}</p>
                <p className="text-sm text-text-tertiary mt-0.5">{section.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <LayoutDashboard className="mx-auto h-12 w-12 text-text-tertiary/40" />
            <p className="mt-3 text-sm text-text-tertiary">No sections available for your role. Contact a super admin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* KPI Card with Sparkline - Subtle tinted cards with per-metric identity */
const KPI_ACCENTS = {
  emerald: {
    hoverBorder: "hover:border-primary/30",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  blue: {
    hoverBorder: "hover:border-status-approved/30",
    iconBg: "bg-status-approved/10",
    iconText: "text-status-approved-text",
  },
  violet: {
    hoverBorder: "hover:border-status-processing/30",
    iconBg: "bg-status-processing/10",
    iconText: "text-status-processing-text",
  },
} as const;

type KpiAccent = keyof typeof KPI_ACCENTS;

function KPICardWithSparkline({
  label,
  value,
  trend,
  sparklineData,
  sparklineColor,
  loading,
  error,
  trendLabel = "vs last period",
  format,
  onClick,
  accent = "emerald",
  icon,
  currency,
}: {
  label: string;
  value: number;
  trend?: { value: number; isPositive: boolean; raw?: number };
  sparklineData?: number[];
  sparklineColor?: string;
  loading: boolean;
  error?: boolean;
  trendLabel?: string;
  format?: "currency" | "number";
  onClick?: () => void;
  accent?: KpiAccent;
  icon?: React.ReactNode;
  currency?: string;
}) {
  const displayValue = error
    ? "—"
    : format === "currency"
      ? formatCurrency(value, currency)
      : formatNumber(value);
  const hasSparkline = !error && !loading && !!sparklineData && sparklineData.length >= 2;
  const a = KPI_ACCENTS[accent];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface-base",
        styles.kpiCard,
        onClick ? cn("cursor-pointer", a.hoverBorder) : "",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", a.iconBg, a.iconText)}>{icon}</span>}
          <p className="text-[13px] font-medium leading-snug text-text-tertiary">{label}</p>
        </div>
        {hasSparkline && (
          <div className="h-8 w-20 shrink-0" aria-hidden="true">
            <SparklineChart data={sparklineData!} color={sparklineColor} height={32} />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="tnum mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[26px]">
          {displayValue}
        </p>
      )}
      {!loading && !error && trend && (
        <p
          className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", trend.isPositive ? "text-status-active-text" : "text-status-rejected-text")}
          title={trend.raw && trend.raw > trend.value ? `${trend.raw}% ${trendLabel}` : undefined}
        >
          {trend.isPositive ? (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          {trend.value}%{trend.raw && trend.raw > trend.value ? "+" : ""} {trendLabel}
        </p>
      )}
    </div>
  );
}

