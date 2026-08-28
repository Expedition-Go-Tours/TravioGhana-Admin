import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  X,
  Star,
  Calendar,
  Hash,
  Ticket,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import api from "@/lib/axios";
import { cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface CustomerProfilePanelProps {
  customerId: string;
  onClose: () => void;
}

interface CustomerReview {
  id?: string;
  rating?: number;
  status?: string;
  title?: string;
  comment?: string;
  createdAt?: string;
  tour?: { title?: string };
}

interface CustomerBooking {
  id?: string;
  status?: string;
  bookingNumber?: string;
  travelDate?: string;
  grossAmount?: number;
  currency?: string;
  tour?: { coverPhoto?: string; title?: string };
}

const STATUS_BADGE: Record<string, "success" | "warning" | "error" | "info"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
  FLAGGED: "info",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "error",
  NO_SHOW: "warning",
  REFUNDED: "warning",
};

export function CustomerProfilePanel({ customerId, onClose }: CustomerProfilePanelProps) {
  const [activeTab, setActiveTab] = useState<"reviews" | "bookings">("reviews");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user", customerId],
    queryFn: () =>
      api.get(`/admin/users/${customerId}`).then((r) => r.data?.data),
    enabled: !!customerId,
  });

  const user = data?.user;
  const bookings = (data?.bookings || []) as CustomerBooking[];
  const reviewStats = data?.reviewStats;
  const recentReviews = (data?.recentReviews || []) as CustomerReview[];

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("h-3 w-3", s <= rating ? "fill-amber-400 text-amber-400" : "text-text-tertiary")}
        />
      ))}
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-surface-base border-l border-border shadow-[-4px_0_16px_rgba(0,0,0,0.06)] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Customer Profile</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : user ? (
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary ring-2 ring-primary/10">
                  {user.photoURL ? (
                    <OptimizedImage src={user.photoURL} alt="" width={56} className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <span className={user.photoURL ? "opacity-0" : ""}>
                    {(user.name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-base font-semibold text-text-primary break-words">{user.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", user.active ? "bg-status-active" : "bg-text-tertiary")} />
                    {user.active ? "Active" : "Inactive"}
                    {user.lastLoginAt && (
                      <>
                        <span>·</span>
                        <span>Last seen {timeAgo(user.lastLoginAt)}</span>
                      </>
                    )}
                  </div>
                  {user.email && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Phone className="h-3 w-3" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  {user.createdAt && (
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <Calendar className="h-3 w-3" />
                      <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {reviewStats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-muted border border-border p-3 text-center">
                    <p className="text-lg font-bold text-text-primary">{reviewStats.totalReviews}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">Reviews</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted border border-border p-3 text-center">
                    <div className="flex justify-center">{reviewStats.averageRating ? renderStars(Math.round(reviewStats.averageRating)) : <span className="text-lg font-bold text-text-tertiary">—</span>}</div>
                    <p className="text-[11px] text-text-secondary mt-1">Avg Rating</p>
                    {reviewStats.averageRating && (
                      <p className="text-[10px] text-text-tertiary">{reviewStats.averageRating}/5</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-surface-muted border border-border p-3 text-center">
                    <p className="text-lg font-bold text-text-primary">{bookings.length > 0 ? data?.bookings?.length || 0 : 0}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">Bookings</p>
                  </div>
                </div>
              )}

              {(recentReviews.length > 0 || bookings.length > 0) && (
                <div className="flex border-b border-border -mx-5 px-5 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("reviews")}
                    className={cn(
                      "flex items-center gap-1.5 pb-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === "reviews"
                        ? "border-primary text-primary"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Reviews {reviewStats?.totalReviews != null && `(${reviewStats.totalReviews})`}
                  </button>
                  <button
                    onClick={() => setActiveTab("bookings")}
                    className={cn(
                      "flex items-center gap-1.5 pb-2.5 text-xs font-medium border-b-2 transition-colors ml-6 whitespace-nowrap",
                      activeTab === "bookings"
                        ? "border-primary text-primary"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    Bookings ({bookings.length})
                  </button>
                </div>
              )}

              {activeTab === "reviews" && recentReviews.length > 0 && (
                <div className="space-y-2">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-border bg-surface-base p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating || 0)}
                          <span className="text-xs text-text-tertiary">({review.rating}/5)</span>
                        </div>
                        {review.status && (
                          <Badge variant={STATUS_BADGE[review.status] || "info"} className="text-[10px] px-1.5 py-0">
                            {review.status}
                          </Badge>
                        )}
                      </div>
                      {review.title && (
                        <p className="text-xs font-medium text-text-primary">{review.title}</p>
                      )}
                      {review.comment && (
                        <p className="text-[11px] text-text-secondary line-clamp-2">{review.comment}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-text-tertiary pt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {review.tour?.title || "Unknown tour"}
                        </span>
                        <span>{timeAgo(review.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "bookings" && bookings.length > 0 && (
                <div className="space-y-2">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="rounded-lg border border-border bg-surface-base p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden bg-surface-muted border border-border">
                          {booking.tour?.coverPhoto ? (
                            <OptimizedImage src={booking.tour.coverPhoto} alt="" width={40} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Ticket className="h-4 w-4 text-text-tertiary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {booking.tour?.title || "Unknown tour"}
                            </p>
                            {booking.status && (
                              <Badge variant={STATUS_BADGE[booking.status] || "info"} className="text-[10px] px-1.5 py-0 shrink-0">
                                {booking.status}
                              </Badge>
                            )}
                          </div>
                          {booking.bookingNumber && (
                            <div className="flex items-center gap-1 text-[10px] text-text-tertiary mt-1">
                              <Hash className="h-2.5 w-2.5" />
                              <span>{booking.bookingNumber}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-1">
                            {booking.travelDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(booking.travelDate).toLocaleDateString()}
                              </span>
                            )}
                            {booking.grossAmount != null && (
                              <span className="font-medium text-text-secondary">
                                {booking.currency || "USD"} {Number(booking.grossAmount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "reviews" && recentReviews.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted mb-3">
                    <MessageSquareText className="h-6 w-6 text-text-tertiary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-1">No reviews</p>
                  <p className="text-xs text-text-secondary">This customer hasn't written any reviews yet.</p>
                </div>
              )}

              {activeTab === "bookings" && bookings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted mb-3">
                    <Ticket className="h-6 w-6 text-text-tertiary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-1">No bookings</p>
                  <p className="text-xs text-text-secondary">This customer has no bookings yet.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 mb-3">
                <ShieldCheck className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">Failed to load profile</p>
              <p className="text-xs text-text-secondary">Could not fetch customer details.</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
