import { useState, useMemo, useEffect, useCallback, startTransition } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  X,
  ArrowLeft,
  RefreshCw,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Ban,
  Inbox,
  AlertCircle,
  Calendar,
  Hash,
  MapPin,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/Pagination";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { BookingDetailPanel } from "./components/BookingDetailPanel";
import { ConfirmPaymentDialog } from "./components/ConfirmPaymentDialog";
import { ChargeNowDialog } from "./components/ChargeNowDialog";
import type { Booking } from "@/types/booking";
import { isPaymentPaid, travelerCount } from "@/types/booking";
import OptimizedImage from "@/components/shared/OptimizedImage";

const STATUS_BADGE: Record<string, "success" | "warning" | "error" | "info"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "error",
  NO_SHOW: "error",
  REFUNDED: "warning",
};

const PAYMENT_BADGE: Record<string, "success" | "warning" | "error"> = {
  PAID: "success",
  SUCCEEDED: "success",
  PENDING: "warning",
  PROCESSING: "warning",
  FAILED: "error",
  REFUNDED: "warning",
  PARTIALLY_REFUNDED: "warning",
};

const STAGGER_LIST = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const FADE_SLIDE = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const STATUS_PILLS = ["All", "Pending", "Confirmed", "Completed", "Cancelled"];

const statCards = [
  { label: "Total", key: "total", gradient: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900", Icon: ShoppingCart },
  { label: "Pending", key: "PENDING", gradient: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900", Icon: Clock },
  { label: "Confirmed", key: "CONFIRMED", gradient: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900", Icon: CheckCircle2 },
  { label: "Completed", key: "COMPLETED", gradient: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900", Icon: CheckCircle2 },
  { label: "Cancelled", key: "CANCELLED", gradient: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900", Icon: Ban },
];

export default function BookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmPayBooking, setConfirmPayBooking] = useState<Booking | null>(null);
  const limit = 20;

  useSocketInvalidate("admin:new-booking", ["admin", "bookings"]);

  const statusParam = statusFilter === "All" ? "" : statusFilter.toUpperCase();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "bookings", { page, limit, status: statusParam }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusParam) params.set("status", statusParam);
      return api.get(`/admin/bookings?${params.toString()}`).then((r) => r.data?.data);
    },
    refetchOnWindowFocus: false,
  });

  const rawBookings: Booking[] = useMemo(
    () => data?.bookings || data?.data?.bookings || [],
    [data],
  );
  const pagination = data?.pagination || data?.data?.pagination;
  const counts = data?.counts || data?.data?.counts || {};

  const query = searchQuery.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!query) return rawBookings;
    return rawBookings.filter((b) =>
      [b.bookingNumber, b.customer?.name, b.tour?.title, b.tour?.supplier?.name]
        .some((f) => f?.toLowerCase().includes(query))
    );
  }, [rawBookings, query]);

  const confirmPaymentMutation = useMutation({
    mutationFn: (body: { reference?: string }) =>
      api.patch(`/admin/bookings/${confirmPayBooking?.id}/confirm-payment`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      toast.success(`Payment confirmed for #${confirmPayBooking?.bookingNumber}`);
      setConfirmPayBooking(null);
      setSelectedBooking(null);
    },
    onError: () => toast.error("Failed to confirm payment"),
  });

  const [chargeNowBooking, setChargeNowBooking] = useState<Booking | null>(null);

  const chargeNowMutation = useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/admin/bookings/${bookingId}/charge-now`),
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      const b = chargeNowBooking || rawBookings.find((x) => x.id === bookingId);
      toast.success(`Card charged for #${b?.bookingNumber || bookingId}`);
      setChargeNowBooking(null);
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to charge card");
    },
  });

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const bookingIdFromState = (location.state as { bookingId?: string })?.bookingId;
  const bookingIdFromUrl = searchParams.get("bookingId");
  const bookingId = bookingIdFromState || bookingIdFromUrl;

  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const findInCaches = useCallback((id: string): Booking | undefined => {
    const recent = queryClient.getQueryData<Booking[]>(["admin", "bookings", "recent"]);
    if (recent) {
      const found = recent.find((b) => b.id === id);
      if (found) return found;
    }
    const allCaches = queryClient.getQueriesData<{ bookings?: Booking[] }>({ queryKey: ["admin", "bookings"] });
    for (const [, data] of allCaches) {
      if (!data?.bookings) continue;
      const found = data.bookings.find((b) => b.id === id);
      if (found) return found;
    }
    return undefined;
  }, [queryClient]);

  const cachedBooking = useMemo(() => {
    if (!bookingId || deepLinkHandled) return undefined;
    return findInCaches(bookingId);
  }, [bookingId, findInCaches, deepLinkHandled]);

  const { data: fetchedBooking } = useQuery({
    queryKey: ["admin", "booking", bookingId],
    queryFn: () => api.get(`/admin/bookings/${bookingId}`).then((r) => r.data?.data as Booking),
    enabled: !!bookingId && !cachedBooking,
  });

  const deepLinkBooking = cachedBooking || fetchedBooking;

  useEffect(() => {
    if (!deepLinkBooking || deepLinkHandled) return;
    startTransition(() => {
      setDeepLinkHandled(true);
      setSelectedBooking(deepLinkBooking);
    });

    if (location.state?.bookingId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (searchParams.get("bookingId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("bookingId");
      setSearchParams(next, { replace: true });
    }
  }, [deepLinkBooking, deepLinkHandled, location.pathname, location.state?.bookingId, navigate, searchParams, setSearchParams]);

  return (
    <div className="space-y-4 md:space-y-5 w-full h-full flex flex-col">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-base hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-text-secondary" />
            </motion.button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-text-primary truncate">Bookings</h1>
              <p className="text-sm text-text-secondary truncate">View and manage all tour bookings</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center justify-center h-9 px-3 text-xs font-medium rounded-md border border-border bg-surface-base text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50 gap-1.5 shrink-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            <span className="hidden sm:inline">{isRefetching ? "Refreshing..." : "Refresh"}</span>
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            className={`rounded-lg shadow-sm border-0 p-5 ${stat.gradient}`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground truncate">{stat.label}</p>
                <div className="text-3xl font-bold tracking-tight text-text-primary tabular-nums">
                  {isLoading ? (
                    <Skeleton className="inline-block w-10 h-8 align-middle" />
                  ) : (
                    counts[stat.key] ?? 0
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                <stat.Icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.08 }}
      >
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search by booking #, customer, tour..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-surface-muted p-0.5 rounded-lg border border-border w-full sm:w-auto overflow-x-auto scrollbar-none">
          {STATUS_PILLS.map((pill) => (
            <motion.button
              key={pill}
              layout
              onClick={() => { setStatusFilter(pill); setPage(1); }}
              className={cn(
                "relative px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
                statusFilter === pill ? "text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {statusFilter === pill && (
                <motion.span
                  layoutId="activePill"
                  className="absolute inset-0 bg-surface-base rounded-md border border-border shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{pill}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            variants={STAGGER_LIST}
            initial="hidden"
            animate="visible"
            className="space-y-2 flex-1"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                variants={FADE_SLIDE}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface-base p-4"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </motion.div>
            ))}
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center flex-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 mb-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">Failed to load bookings</p>
            <p className="text-xs text-text-tertiary mb-4">Something went wrong. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center flex-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted mb-3">
              <Inbox className="h-6 w-6 text-text-tertiary" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">
              {query ? "No matching bookings" : "No bookings yet"}
            </p>
            <p className="text-xs text-text-tertiary">
              {query ? "Try a different search term" : "Bookings will appear here once customers start booking tours."}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            variants={STAGGER_LIST}
            initial="hidden"
            animate="visible"
            className="flex-1 min-h-0"
          >
            <div className="rounded-lg border border-border bg-surface-base overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-surface-muted/60">
                      <th className="whitespace-nowrap text-left text-xs font-semibold text-text-secondary px-4 py-3">Booking #</th>
                      <th className="whitespace-nowrap text-left text-xs font-semibold text-text-secondary px-4 py-3">Customer</th>
                      <th className="whitespace-nowrap text-left text-xs font-semibold text-text-secondary px-4 py-3">Tour</th>
                      <th className="whitespace-nowrap text-left text-xs font-semibold text-text-secondary px-4 py-3">Tour Date</th>
                      <th className="whitespace-nowrap text-left text-xs font-semibold text-text-secondary px-4 py-3">Created</th>
                      <th className="whitespace-nowrap text-center text-xs font-semibold text-text-secondary px-4 py-3">Guests</th>
                      <th className="whitespace-nowrap text-right text-xs font-semibold text-text-secondary px-4 py-3">Total</th>
                      <th className="whitespace-nowrap text-center text-xs font-semibold text-text-secondary px-4 py-3">Status</th>
                      <th className="whitespace-nowrap text-center text-xs font-semibold text-text-secondary px-4 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((booking) => (
                      <motion.tr
                        key={booking.id}
                        variants={FADE_SLIDE}
                        onClick={() => {
                          setSelectedBooking(booking);
                          setSearchParams({ bookingId: booking.id });
                        }}
                        className={cn(
                          "min-h-[48px] border-b border-border/50 cursor-pointer transition-colors hover:bg-surface-muted/40",
                          selectedBooking?.id === booking.id && "bg-primary/5",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Hash className="h-3 w-3 text-text-tertiary" />
                            <span className="text-xs font-medium text-text-primary">{booking.bookingNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent text-[10px] font-bold text-accent-foreground">
                              {booking.customer.photoURL ? (
                                <OptimizedImage src={booking.customer.photoURL} alt="" width={28} className="absolute inset-0 h-full w-full object-cover" />
                              ) : null}
                              <span className={booking.customer.photoURL ? "opacity-0" : ""}>
                                {(booking.customer.name || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-text-primary truncate">{booking.customer.name}</p>
                              <p className="text-[10px] text-text-tertiary truncate">{booking.customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
                            <div className="w-7 h-7 rounded-md shrink-0 overflow-hidden bg-surface-muted border border-border">
                              {booking.tour.coverPhoto ? (
                                <OptimizedImage src={booking.tour.coverPhoto} alt="" width={28} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <MapPin className="h-3 w-3 text-text-tertiary" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-text-primary truncate">{booking.tour.title}</p>
                              <p className="text-[10px] text-text-tertiary truncate">{booking.tour.supplier.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-text-tertiary" />
                            <span className="text-xs text-text-secondary">
                              {new Date(booking.travelDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-text-tertiary" />
                            <span className="text-xs text-text-tertiary">
                              {new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium text-text-secondary tabular-nums">
                            {travelerCount(booking.travelers)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-semibold text-text-primary tabular-nums">
                              {booking.currency} {Number(booking.grossAmount).toLocaleString()}
                            </span>
                            {booking.discounts > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-red-50 border border-red-200/60 text-[9px] font-medium text-red-700">
                                <Tag size={8} />
                                {booking.offerName || 'Discount'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_BADGE[booking.status] || "info"} className="text-[10px] px-1.5 py-0">
                            {booking.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={PAYMENT_BADGE[booking.paymentStatus] || "warning"} className="text-[10px] px-1.5 py-0">
                            {isPaymentPaid(booking.paymentStatus) ? (
                              <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                            ) : booking.paymentStatus === "FAILED" ? (
                              "Failed"
                            ) : booking.paymentStatus === "PROCESSING" ? (
                              "Processing"
                            ) : booking.paymentTiming === "later" ? (
                              <><Clock className="h-2.5 w-2.5" /> Pay Later</>
                            ) : (
                              "Pending"
                            )}
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                page={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                onPageChange={setPage}
                className="mt-3"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailPanel
            booking={selectedBooking}
            onClose={() => {
              setSelectedBooking(null);
              const next = new URLSearchParams(searchParams);
              next.delete("bookingId");
              setSearchParams(next, { replace: true });
            }}
            onConfirmPayment={(booking) => {
              setConfirmPayBooking(booking);
            }}
            onChargeNow={(booking) => {
              setChargeNowBooking(booking);
            }}
            onViewCustomer={() => {
              setSelectedBooking(null);
            }}
          />
        )}
      </AnimatePresence>

      {confirmPayBooking && (
        <ConfirmPaymentDialog
          booking={confirmPayBooking}
          isPending={confirmPaymentMutation.isPending}
          onConfirm={(reference) => confirmPaymentMutation.mutate({ reference })}
          onClose={() => setConfirmPayBooking(null)}
        />
      )}

      {chargeNowBooking && (
        <ChargeNowDialog
          booking={chargeNowBooking}
          isPending={chargeNowMutation.isPending}
          onConfirm={() => chargeNowMutation.mutate(chargeNowBooking.id)}
          onClose={() => setChargeNowBooking(null)}
        />
      )}
    </div>
  );
}
