import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  grossAmount: number;
  currency: string;
  createdAt: string;
  customer: { name: string; email: string; photoURL?: string };
  tour: { title: string };
}

interface RecentBookingsTableProps {
  bookings?: Booking[];
  loading?: boolean;
}

export function RecentBookingsTable({ bookings = [], loading }: RecentBookingsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full rounded-2xl border border-border/60 bg-surface-base shadow-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
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

      {loading ? (
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
            <div
              key={booking.id}
              className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer"
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
                  {booking.customer?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {booking.customer?.name || "Unknown"}
                  </p>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-text-tertiary">
                  {booking.tour?.title || "—"} · {formatDate(booking.createdAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {formatCurrency(booking.grossAmount, booking.currency)}
                </p>
                <p className="text-[10px] text-text-tertiary">{booking.bookingNumber}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}