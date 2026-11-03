import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { SectionError } from "@/components/shared/SectionError";

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  grossAmount: number;
  currency: string;
  createdAt: string;
  customer: { name: string; email: string; photoURL?: string } | null;
  /** Present on every row; who the booking is for when there is no account. */
  leadTravelerName?: string | null;
  tour: { title: string };
}

interface RecentBookingsTableProps {
  bookings?: Booking[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function RecentBookingsTable({ bookings = [], loading, error, onRetry }: RecentBookingsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full min-w-0 rounded-xl border border-border bg-surface-base p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-status-approved/10 dark:bg-status-approved/10 text-status-approved-text dark:text-status-approved-text">
            <CalendarCheck className="h-4 w-4" />
          </span>
          <h3 className="text-[15px] font-semibold text-text-primary">Recent Bookings</h3>
        </div>
        <button
          onClick={() => navigate("/admin/bookings")}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </button>
      </div>

      {error ? (
        <SectionError message="Failed to load recent bookings" onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-secondary">No recent bookings</div>
      ) : (
        <div className="space-y-2">
          {bookings.slice(0, 5).map((booking) => (
            <button
              key={booking.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => navigate(`/admin/bookings?bookingId=${booking.id}`, { state: { bookingId: booking.id } })}
            >
              {booking.customer?.photoURL ? (
                <OptimizedImage
                  src={booking.customer.photoURL}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                  width={40}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {(booking.customer?.name || booking.leadTravelerName)?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {/* A guest checkout has no account: the lead traveller is
                        the person the booking is for, not "Unknown". */}
                    {booking.customer?.name || booking.leadTravelerName || "Guest"}
                  </p>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-text-tertiary">
                  {booking.tour?.title || "—"} · {formatDate(booking.createdAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum text-sm font-semibold text-text-primary">
                  {formatCurrency(booking.grossAmount, booking.currency)}
                </p>
                <p className="tnum text-[10px] text-text-tertiary">{booking.bookingNumber}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}