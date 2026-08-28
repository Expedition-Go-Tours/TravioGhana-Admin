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
import { motion } from "framer-motion";
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
import { NotificationsCard, type NotificationStats } from "./overview/NotificationsCard";
import { RecentBookingsTable } from "./overview/RecentBookingsTable";
import styles from "./Overview.module.css";
import api from "@/lib/axios";
import { getAdminSocket } from "@/lib/adminSocket";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { staggerContainer, fadeInUp } from "@/lib/animations";
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
  eventFeed?: Array<{ message?: string; userName?: string; createdAt?: string; resource?: string }>;
}

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
  const [timeFilter, setTimeFilter] = useState("today");

  const periodLabel = (base: string) => {
    const labels: Record<string, string> = {
      today: `${base} Today`,
      last_week: `${base} (7d)`,
      last_month: `${base} (30d)`,
      last_quarter: `${base} (90d)`,
    };
    return labels[timeFilter] || `${base} (7d)`;
  };
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [showTodayBookings, setShowTodayBookings] = useState(false);
  const [showNewSignups, setShowNewSignups] = useState(false);

  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: overviewRefetch } = useQuery({
    queryKey: ["admin", "overview", timeFilter],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/analytics/overview", { params: { period: timeFilter } });
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
          eventFeed: ((d?.eventFeed as Array<Record<string, unknown>>) || []).map((e) => ({
            message: typeof e.properties === "object" && e.properties ? ((e.properties as Record<string, unknown>).message as string) || (e.name as string) : (e.name as string),
            userName: (e.userName as string) || null,
            createdAt: e.createdAt as string,
            resource: (e.resource as string) || "",
          })),
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

  const { data: payoutSummary } = useQuery({
    queryKey: ["admin", "payout-summary"],
    enabled: can('payouts.view'),
    queryFn: async () => {
      const res = await api.get("/payouts/admin/summary");
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
    queryKey: ["admin", "active-users"],
    queryFn: async () => {
      const res = await api.get("/admin/users/active");
      return (res.data?.data?.users || []) as Array<{ id: string; name: string; email: string; photoURL?: string; roles?: string[]; lastLoginAt?: string }>;
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
        customer: { id: string; name: string; email: string };
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
  const { data: recentBookings, isLoading: recentBookingsLoading } = useQuery({
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
  const { data: notifStats, isLoading: notifStatsLoading } = useQuery({
    queryKey: ["admin", "notifications", "stats"],
    queryFn: async () => {
      const res = await api.get("/admin/notifications/stats");
      return res.data.data as NotificationStats;
    },
    enabled: can("notifications.view"),
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getAdminSocket();
    const refetchOverview = () => queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    const refetchSignups = () => queryClient.invalidateQueries({ queryKey: ["admin", "users", "new-signups"] });
    const refetchTodayBookings = () => queryClient.invalidateQueries({ queryKey: ["admin", "bookings", "today"] });
    const refetchRevenueTrend = () => queryClient.invalidateQueries({ queryKey: ["admin", "revenue-trend"] });
    const refetchNotifStats = () => queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "stats"] });
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
    return () => {
      socket.off("admin:signup", onSignup);
      socket.off("admin:new-booking", onBooking);
      socket.off("admin:new-review", onReview);
      socket.off("admin:tour-update", onTourChange);
      socket.off("admin:supplier-application", onSupplierApp);
      socket.off("admin:supplier-status-change", onSupplierStatus);
      socket.off("admin:payout-update", onPayout);
    };
  }, [queryClient]);

  const calcTrend = (current: number | undefined | null, previous: number | undefined | null): { value: number; isPositive: boolean } | undefined => {
    const cur = Number(current) || 0;
    if (cur === 0) return undefined;
    const prev = Number(previous) || 0;
    if (prev === 0) return { value: 0, isPositive: true };
    const change = ((cur - prev) / prev) * 100;
    const rounded = Math.min(Math.abs(Math.round(change)), 100);
    return { value: rounded, isPositive: change >= 0 };
  };

  // Sparkline data from real API (last 7 data points from weekly booking data)
  const weeklyBookingData = overview?.weeklyBookingData || [];
  const bookingsSparkline = weeklyBookingData.length > 0
    ? weeklyBookingData.slice(-7).map((d) => d.count)
    : [Number(overview?.bookings?.today) || 0];
  const revenueSparkline = [Number(overview?.revenue?.today?.revenue) || 0];
  const usersSparkline = [Number(overview?.activeUsers) || 0];

  const weeklyTotal = weeklyBookingData.reduce((sum, d) => sum + d.count, 0);

  const weeklyTrend = (() => {
    if (weeklyBookingData.length < 2) return undefined;
    const mid = Math.floor(weeklyBookingData.length / 2);
    const firstHalf = weeklyBookingData.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const secondHalf = weeklyBookingData.slice(mid).reduce((s, d) => s + d.count, 0);
    return calcTrend(secondHalf, firstHalf);
  })();

  // Transform event feed for RecentActivityPanel
  const activities = (overview?.eventFeed || []).slice(0, 10).map((event, idx) => {
    const resource = (event.resource || "").toLowerCase();
    const type:
      | "booking"
      | "user"
      | "review"
      | "alert"
      | "update"
      | "message"
      | "payout"
      | "supplier"
      | "offer"
      | "team"
      | "role"
      | "webhook" =
      resource === "booking" || resource === "payment" ? "booking"
      : resource === "user" || resource === "customer" || resource === "authentication" ? "user"
      : resource === "review" ? "review"
      : resource === "security" ? "alert"
      : resource === "tour" || resource === "systemconfig" || resource === "settings" ? "update"
      : resource === "payout" || resource === "payoutmethod" ? "payout"
      : resource === "supplierprofile" ? "supplier"
      : resource === "specialoffer" ? "offer"
      : resource === "teammember" ? "team"
      : resource === "adminrole" ? "role"
      : resource === "webhook" || resource === "socket" ? "webhook"
      : idx % 3 === 0 ? "booking" : idx % 3 === 1 ? "user" : "update";
    return {
      id: String(idx),
      type,
      title: event.message || "Activity",
      description: event.userName || "System",
      timestamp: event.createdAt || "",
    };
  });

  const userName = localStorage.getItem("userName") || "Admin";

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn("-mx-4 md:-mx-6 lg:-mx-8 space-y-4 md:space-y-5", styles.container)}
    >
      {overview?.forbidden ? (
        <WelcomeDashboard />
      ) : (
        <>
          {/* Welcome Header */}
          <motion.div variants={fadeInUp} className="flex items-start justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-text-primary">
                Hello, {userName}
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Here are the latest insights from your customer interactions.
              </p>
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_week">Last week</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last_quarter">Last quarter</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* KPI Cards with Sparklines */}
          <motion.div variants={fadeInUp} className={styles.kpiGrid}>
            {can('dashboard.bookings') && (
              <KPICardWithSparkline
                label={periodLabel("Bookings")}
                value={overviewLoading ? 0 : Number(overview?.bookings?.today) || 0}
                trend={calcTrend(overview?.bookings?.today, overview?.bookings?.yesterday)}
                sparklineData={bookingsSparkline}
                sparklineColor="hsl(var(--status-active))"
                loading={overviewLoading}
                onClick={() => setShowTodayBookings(true)}
                accent="emerald"
                icon={<ShoppingCart className="h-4 w-4" />}
              />
            )}
            {can('dashboard.revenue') && (
              <KPICardWithSparkline
                label={periodLabel("Revenue")}
                value={overviewLoading ? 0 : Number(overview?.revenue?.today?.revenue) || 0}
                trend={calcTrend(
                  overview?.revenue?.today?.revenue ? Number(overview.revenue.today.revenue) : undefined,
                  overview?.revenue?.yesterday?.revenue ? Number(overview.revenue.yesterday.revenue) : undefined
                )}
                sparklineData={revenueSparkline}
                sparklineColor="hsl(var(--status-approved))"
                loading={overviewLoading}
                format="currency"
                accent="blue"
                icon={<Banknote className="h-4 w-4" />}
              />
            )}
            {can('users.view') && (
              <KPICardWithSparkline
                label={periodLabel("Active Users")}
                value={overviewLoading ? 0 : Number(overview?.activeUsers) || 0}
                trend={calcTrend(overview?.activeUsers, overview?.activeUsersPrevious)}
                sparklineData={usersSparkline}
                sparklineColor="hsl(var(--chart-5))"
                loading={overviewLoading}
                onClick={() => setShowActiveUsers(true)}
                accent="violet"
                icon={<UserCheck className="h-4 w-4" />}
              />
            )}
          </motion.div>

          {/* Booking Volume + Recent Activity */}
          <motion.div variants={fadeInUp} className={styles.contentGrid3}>
            <div className="lg:col-span-2">
              <BookingVolumeChart
                data={weeklyBookingData}
                total={weeklyTotal}
                trend={weeklyTrend}
                loading={overviewLoading}
                period={timeFilter}
              />
            </div>
            <div className="lg:col-span-1">
              <RecentActivityPanel
                activities={activities}
                loading={overviewLoading}
              />
            </div>
          </motion.div>

          {/* Top Suppliers + Notifications + Recent Bookings */}
          <motion.div variants={fadeInUp} className={styles.contentGrid3}>
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
              />
            </div>
            <div className="lg:col-span-1">
              <RecentBookingsTable bookings={recentBookings} loading={recentBookingsLoading} />
            </div>
          </motion.div>

          {/* Top Tours */}
          {can('tours.view') && (
            <motion.div variants={fadeInUp}>
              <Card>
                <CardHeader className="border-b border-primary/10 pb-3.5">
                  <CardTitle className="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-text-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      <Map className="h-4 w-4" />
                    </span>
                    Top Tours
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {overviewLoading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                    </div>
                  ) : overviewError ? (
                    <SectionError message="Failed to load tours" onRetry={() => overviewRefetch()} />
                  ) : !overview?.topTours?.length ? (
                    <SectionEmpty message="No top tours data" />
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {overview.topTours.map((tour, idx) => (
                        <div
                          key={tour.id || idx}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                          onClick={() => navigate("/admin/tours")}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate("/admin/tours"); }}
                        >
                          <span className={cn(
                            "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                            idx === 0 ? "bg-emerald-600 text-white" : idx === 1 ? "bg-blue-500 text-white" : idx === 2 ? "bg-violet-500 text-white" : "text-text-tertiary"
                          )}>
                            {idx + 1}
                          </span>
                          {tour.coverPhoto ? (
                            <OptimizedImage src={tour.coverPhoto} alt="" width={32} className="h-8 w-8 rounded-md object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-surface-muted flex items-center justify-center shrink-0">
                              <MapPin className="h-4 w-4 text-text-tertiary" />
                            </div>
                          )}
                          <span className="font-medium text-text-primary truncate flex-1 min-w-0">{tour.title}</span>
                          <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
                            <span className="text-text-secondary text-right w-16">{formatNumber(tour.bookingCount)} <span className="text-text-tertiary">bk</span></span>
                            <span className="text-text-primary font-semibold text-right w-20">{formatCurrency(tour.revenue, tour.currency)}</span>
                            {tour.averageRating != null && (
                              <span className={cn("text-right w-10", styles.hideMobile)}>
                                <span className="text-status-pending font-semibold">{Number(tour.averageRating).toFixed(1)}</span>
                              </span>
                            )}
                            <span className={cn("text-text-tertiary text-right w-14", styles.hideMobile)}>{formatNumber(tour.reviewCount)} <span className="text-text-tertiary">rv</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Bottom Grid: Booking Status + Payout Summary */}
          {(can('dashboard.bookings') || can('dashboard.*') || can('payouts.view')) && (
            <motion.div variants={fadeInUp} className={styles.contentGrid2}>
              {can('dashboard.bookings') && (
                <Card>
                  <CardHeader className="border-b border-primary/10 pb-3.5">
                    <CardTitle className="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-text-primary">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        <Activity className="h-4 w-4" />
                      </span>
                      Booking Status
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
                        <div className={styles.chartPie}><ResponsiveContainer width="100%" height="100%">
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
                            <Tooltip />
                          </RePieChart>
                        </ResponsiveContainer></div>
                        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                          {(overview.bookingStatusDistribution || []).map((d, i) => (
                            <span key={d.status || `legend-${i}`} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bookingColors[d.status || ""] || "hsl(var(--status-suspended))" }} />
                              {d.status || "Unknown"}
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
                  <CardHeader className="border-b border-primary/10 pb-3.5">
                    <CardTitle className="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-text-primary">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        <Banknote className="h-4 w-4" />
                      </span>
                      Payout Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {!payoutSummary ? (
                      <Skeleton className="h-28 w-full rounded-xl" />
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-400" />
                            <span className="text-sm text-text-secondary">Outstanding</span>
                          </div>
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatNumber(payoutSummary.outstanding?.count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            <span className="text-sm text-text-secondary">Pending</span>
                          </div>
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatNumber(payoutSummary.pending?.count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-sm text-text-secondary">Paid This Month</span>
                          </div>
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(payoutSummary.paidThisMonth?.count)}</span>
                        </div>
                        <div className="text-xs text-text-tertiary space-y-1.5 pt-1">
                          <div className="flex justify-between"><span>Outstanding total</span><span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(payoutSummary.outstanding?.totalAmount)}</span></div>
                          <div className="flex justify-between"><span>Pending total</span><span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(payoutSummary.pending?.totalAmount)}</span></div>
                          <div className="flex justify-between"><span>Paid total</span><span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(payoutSummary.paidThisMonth?.totalAmount)}</span></div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full h-10 rounded-xl group" onClick={() => navigate("/admin/payouts")}>
                          View All Payouts
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Dialogs */}
          {showActiveUsers && (
            <ModalShell title="Active Users (30d)" onClose={() => setShowActiveUsers(false)}>
              {activeUsersLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : !activeUsersData?.length ? (
                <div className="py-12 text-center text-sm text-text-tertiary">No active users in the last 30 days</div>
              ) : (
                <div className="divide-y divide-border">
                  {activeUsersData.map((user) => (
                    <div key={user.id} className="flex items-start gap-3 px-4 py-3">
                      {user.photoURL ? (
                        <OptimizedImage src={user.photoURL} alt="" width={32} className="h-8 w-8 shrink-0 rounded-[10px] object-cover mt-0.5" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-muted text-xs font-medium text-text-secondary mt-0.5">
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{user.name || "Unknown"}</p>
                        <p className="text-xs text-text-tertiary truncate">{user.email || "—"}</p>
                      </div>
                      {user.lastLoginAt && (
                        <span className="shrink-0 text-xs text-text-tertiary whitespace-nowrap pt-1">{formatDate(user.lastLoginAt)}</span>
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
                          <p className="text-sm text-text-primary truncate">{booking.customer?.name || "Unknown"}</p>
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
                        <OptimizedImage src={user.photoURL} alt="" width={32} className="h-8 w-8 shrink-0 rounded-[10px] object-cover mt-0.5" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-muted text-xs font-medium text-text-secondary mt-0.5">
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
    </motion.div>
  );
}

/* Modal Shell */
function ModalShell({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          "relative w-full sm:rounded-xl bg-surface-base border border-border shadow-soft-lg overflow-hidden",
          "max-h-[85dvh] flex flex-col",
          wide ? "max-w-2xl" : "max-w-lg",
          "rounded-t-xl sm:rounded-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
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
      </motion.div>
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
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeInUp} className="border-l-2 border-l-primary pl-3">
        <h1 className="text-lg md:text-xl font-semibold text-text-primary">
          Welcome{adminRole?.name ? `, ${adminRole.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}` : ''}
        </h1>
        <p className="text-sm text-text-secondary mt-1">Select a section below to get started</p>
      </motion.div>
      {available.length > 0 ? (
        <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {available.map((section) => (
            <button
              key={section.route}
              onClick={() => navigate(section.route)}
              className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-base p-5 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/30 hover:shadow-tinted hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground group-hover:scale-105 transition-transform duration-300">
                {section.icon}
              </div>
              <div>
                <p className="font-medium text-text-primary">{section.label}</p>
                <p className="text-sm text-text-tertiary mt-0.5">{section.desc}</p>
              </div>
            </button>
          ))}
        </motion.div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <LayoutDashboard className="mx-auto h-12 w-12 text-text-tertiary/40" />
            <p className="mt-3 text-sm text-text-tertiary">No sections available for your role. Contact a super admin.</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

/* KPI Card with Sparkline - Subtle tinted cards with per-metric identity */
const KPI_ACCENTS = {
  emerald: {
    bg: "bg-gradient-to-br from-emerald-50/70 to-surface-base dark:from-emerald-950/20 dark:to-surface-base",
    border: "border-emerald-200/60 dark:border-emerald-800/20",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700/30",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconText: "text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-50/70 to-surface-base dark:from-blue-950/20 dark:to-surface-base",
    border: "border-blue-200/60 dark:border-blue-800/20",
    hoverBorder: "hover:border-blue-300 dark:hover:border-blue-700/30",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "text-blue-700 dark:text-blue-300",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-50/70 to-surface-base dark:from-violet-950/20 dark:to-surface-base",
    border: "border-violet-200/60 dark:border-violet-800/20",
    hoverBorder: "hover:border-violet-300 dark:hover:border-violet-700/30",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconText: "text-violet-700 dark:text-violet-300",
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
  format,
  onClick,
  accent = "emerald",
  icon,
  currency,
}: {
  label: string;
  value: number;
  trend?: { value: number; isPositive: boolean };
  sparklineData: number[];
  sparklineColor: string;
  loading: boolean;
  format?: "currency" | "number";
  onClick?: () => void;
  accent?: KpiAccent;
  icon?: React.ReactNode;
  currency?: string;
}) {
  const displayValue = format === "currency" ? formatCurrency(value, currency) : formatNumber(value);
  const a = KPI_ACCENTS[accent];

  return (
    <div
      className={cn(
        "relative rounded-xl border shadow-sm transition-all duration-200 overflow-hidden",
        a.bg, a.border,
        styles.kpiCard,
        onClick ? cn("cursor-pointer hover:shadow-md hover:-translate-y-0.5", a.hoverBorder) : "",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", a.iconBg, a.iconText)}>{icon}</span>}
            <p className="text-[13px] font-medium text-text-secondary">{label}</p>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28 mt-2" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">{displayValue}</p>
          )}
          {!loading && trend && (
            <p className={cn("mt-2 text-xs font-medium flex items-center gap-1", trend.isPositive ? "text-status-active" : "text-status-rejected")}>
              {trend.isPositive ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {trend.value}% vs last period
            </p>
          )}
        </div>
        <div className="w-24 h-12">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <SparklineChart data={sparklineData} color={sparklineColor} height={48} />
          )}
        </div>
      </div>
    </div>
  );
}


