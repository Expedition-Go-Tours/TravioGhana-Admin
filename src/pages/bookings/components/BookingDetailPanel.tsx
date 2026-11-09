import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  MapPin,
  Calendar,
  CalendarCheck,
  Clock,
  Hash,
  CreditCard,
  Wallet,
  Banknote,
  CheckCircle2,
  Users,
  Percent,
  Mail,
  Phone,
  ArrowUpRight,
  User,
  Baby,
  PersonStanding,
  Globe,
  Tag,
  Zap,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSIONS } from "@/lib/permissions";
import { cn, timeAgo, getStatusColor, formatCurrency, formatDateTime, formatTravelDate } from "@/lib/utils";
import { cancellationReasonLabel, cancellationCategoryLabel } from "@/lib/cancellationReview";
import { paymentSource } from "@/lib/paymentSource";
import { BookingTimeline } from "./BookingTimeline";
import type { Booking, TravelerData } from "@/types/booking";
import { isPaymentPaid, travelerCount } from "@/types/booking";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { bookingContact, contactInitial } from "@/lib/bookingContact";
import { CancellationStatusBadge } from "@/components/cancellations/CancellationStatusBadge";
import { CancellationDecisionDialog } from "@/components/cancellations/CancellationDecisionDialog";
import {
  approveCancellationRequest,
  rejectCancellationRequest,
  getCancellationErrorMessage,
  getCancellationErrorStatus,
} from "@/services/cancellationService";
import type { CancellationRequest, CancellationStatus } from "@/services/cancellationService";

// Booking source = the storefront the sale happened on. Three entities:
// Expedition Go (company storefront), Travio Ghana, Travio Africa.
// The DB stores these as enum values (EXPEDITION / GHANA /
// TRAVIO_AFRICA); TRAVIO is a legacy value from seed data only.
const SOURCE_META: Record<string, { label: string; className: string }> = {
  EXPEDITION: { label: "Expedition Go", className: "bg-primary/10 text-primary" },
  GHANA: { label: "Travio Ghana", className: "bg-status-pending/10 text-status-pending-text" },
  TRAVIO_AFRICA: { label: "Travio Africa", className: "bg-status-approved/10 text-status-approved-text" },
};
const sourceMeta = (source: string) =>
  SOURCE_META[String(source).toUpperCase()] || { label: source, className: "bg-surface-muted text-text-secondary" };

const BOOKING_STATUS_META: Record<string, { label: string; hint: string }> = {
  PENDING: { label: "Pending", hint: "Waiting for the supplier to accept this booking." },
  CONFIRMED: { label: "Confirmed", hint: "The supplier has accepted this booking and the traveler is expected." },
  COMPLETED: { label: "Completed", hint: "The activity date has passed and the booking is closed." },
  CANCELLED: { label: "Cancelled", hint: "This booking was cancelled and is no longer active." },
  NO_SHOW: { label: "No-show", hint: "The customer did not attend the activity." },
  REFUNDED: { label: "Refunded", hint: "The booking was refunded to the customer." },
};

const PAYMENT_STATUS_META: Record<string, { label: string; hint: string }> = {
  PENDING: { label: "Payment pending", hint: "The customer has not been charged yet." },
  SUCCEEDED: { label: "Paid in full", hint: "The customer's payment was captured successfully." },
  PROCESSING: { label: "Payment processing", hint: "The payment is still being processed." },
  FAILED: { label: "Payment failed", hint: "The payment attempt was unsuccessful." },
  CANCELLED: { label: "Payment cancelled", hint: "The payment was cancelled." },
  REFUNDED: { label: "Refunded", hint: "The payment was returned to the customer." },
  PARTIALLY_REFUNDED: { label: "Partially refunded", hint: "Part of the payment was returned to the customer." },
};

function humanizeStatus(status: string) {
  return String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface BookingDetailPanelProps {
  booking: Booking;
  onClose: () => void;
  onConfirmPayment: (booking: Booking) => void;
  onChargeNow: (booking: Booking) => void;
  onViewCustomer: (customerId: string) => void;
}

function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        getStatusColor(status),
      )}
    >
      {label || humanizeStatus(status)}
    </span>
  );
}

function StatusTile({
  label,
  status,
  value,
  hint,
  icon,
}: {
  label: string;
  status: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-base px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
          {icon}
          {label}
        </span>
        <StatusChip status={status} label={value} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{hint}</p>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-[13px] font-semibold text-text-primary">{children}</h3>
      {action}
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-tertiary">
        {icon}
        <span>{label}</span>
      </span>
      <span className="min-w-0 text-right text-xs font-medium text-text-primary">{children}</span>
    </div>
  );
}

function TravelerBreakdown({ travelers }: { travelers: TravelerData }) {
  const categories = [
    { singular: "Adult", plural: "Adults", count: travelers.adults || 0, icon: <User className="h-3.5 w-3.5" /> },
    { singular: "Child", plural: "Children", count: travelers.children || 0, icon: <PersonStanding className="h-3.5 w-3.5" /> },
    { singular: "Infant", plural: "Infants", count: travelers.infants || 0, icon: <Baby className="h-3.5 w-3.5" /> },
    { singular: "Senior", plural: "Seniors", count: travelers.seniors || 0, icon: <Users className="h-3.5 w-3.5" /> },
  ].filter((c) => c.count > 0);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <div key={cat.plural} className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-2.5 py-1.5">
          <span className="text-text-tertiary">{cat.icon}</span>
          <span className="text-xs font-semibold text-text-primary">{cat.count}</span>
          <span className="text-xs text-text-secondary">{cat.count === 1 ? cat.singular : cat.plural}</span>
        </div>
      ))}
    </div>
  );
}

function TravelerManifest({ details }: { details: NonNullable<TravelerData["details"]> }) {
  if (!details || details.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-muted border-b border-border">
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-text-tertiary">#</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-text-tertiary">Name</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-text-tertiary">Traveler type</th>
          </tr>
        </thead>
        <tbody>
          {details.map((t, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="tnum px-3 py-2.5 text-text-tertiary">{i + 1}</td>
              <td className="px-3 py-2.5 font-medium text-text-primary">{t.name || "—"}</td>
              <td className="px-3 py-2.5">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  t.ageGroup === "adult" && "bg-status-approved/10 text-status-approved-text",
                  t.ageGroup === "child" && "bg-status-pending/10 text-status-pending-text",
                  t.ageGroup === "infant" && "bg-status-rejected/10 text-status-rejected-text",
                  t.ageGroup === "senior" && "bg-status-processing/10 text-status-processing-text",
                  !t.ageGroup && "bg-surface-muted text-text-tertiary",
                )}>
                  {t.ageGroup ? t.ageGroup.charAt(0).toUpperCase() + t.ageGroup.slice(1) : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BookingDetailPanel({ booking, onClose, onConfirmPayment, onChargeNow, onViewCustomer }: BookingDetailPanelProps) {
  const navigate = useNavigate();
  const { can } = usePermission();
  const queryClient = useQueryClient();

  // Exit animation needs the panel to stay mounted for one frame longer than
  // the parent's open state. Every close path funnels through runAfterClose so
  // the overlay, X, Escape key, and footer button all behave the same way.
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const runAfterClose = useCallback((action: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(action, reduceMotion ? 0 : 240);
  }, []);

  const requestClose = useCallback(() => {
    runAfterClose(() => onCloseRef.current());
  }, [runAfterClose]);

  const requestViewCustomer = useCallback(
    (customerId: string) => {
      runAfterClose(() => onViewCustomer(customerId));
    },
    [onViewCustomer, runAfterClose],
  );

  // A guest booking has no account behind it; the lead traveller is who the
  // supplier will actually meet, so that is who the panel names.
  const contact = bookingContact(booking);
  const contactAvatar = (
    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-base font-semibold text-primary ring-2 ring-primary/10">
      {contact.photoURL ? (
        <OptimizedImage src={contact.photoURL} alt="" width={48} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <span className={contact.photoURL ? "opacity-0" : ""}>{contactInitial(contact)}</span>
    </div>
  );

  // Modal behaviour: lock the page behind the drawer, trap Tab inside it,
  // close on Escape, and return focus to whatever opened it.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden");

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // A nested Radix dialog (e.g. the cancellation decision) owns Escape
      // and focus while it is open; the drawer must not close underneath it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      previousFocus?.focus?.();
    };
  }, [requestClose]);

  const canDecideCancellation = can(PERMISSIONS.CANCELLATIONS_APPROVE);

  type LocalDecision = {
    status: "APPROVED" | "REJECTED";
    note: string;
    refundAmount?: number | null;
    fee?: number | null;
  };

  // Keying the local overrides by booking + pending-request id lets a fresh
  // booking (or a refetched request) discard stale local state without an
  // effect, while still reflecting an inline decision immediately.
  const pendingKey = `${booking.id}:${booking.pendingCancellation?.id ?? "none"}`;
  const [pendingOverride, setPendingOverride] = useState<{
    key: string;
    pending: Booking["pendingCancellation"];
  } | null>(null);
  const [localDecisionState, setLocalDecisionState] = useState<{ key: string; value: LocalDecision } | null>(null);
  const [decisionState, setDecisionState] = useState<{ key: string; mode: "approve" | "reject" } | null>(null);

  const pending =
    pendingOverride?.key === pendingKey ? pendingOverride.pending ?? null : booking.pendingCancellation ?? null;
  const localDecision = localDecisionState?.key === pendingKey ? localDecisionState.value : null;
  const decisionMode = decisionState?.key === pendingKey ? decisionState.mode : null;

  const invalidateBookingQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "booking"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "cancellations"] });
  };

  const approveCancellation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approveCancellationRequest(id, note ? { note } : {}),
    onSuccess: (res, vars) => {
      setPendingOverride({ key: pendingKey, pending: null });
      setLocalDecisionState({
        key: pendingKey,
        value: {
          status: "APPROVED",
          note: vars.note,
          refundAmount: res.cancellation?.refundAmount ?? res.request?.preview?.refund?.amount,
          fee: res.cancellation?.fee ?? res.request?.preview?.fee,
        },
      });
      setDecisionState(null);
      toast.success("Cancellation approved — full refund executed.");
      invalidateBookingQueries();
    },
    onError: (err: unknown) => {
      toast.error(getCancellationErrorMessage(err, "Failed to approve cancellation request"));
      if (getCancellationErrorStatus(err) === 409) {
        setPendingOverride({ key: pendingKey, pending: null });
        invalidateBookingQueries();
      }
      setDecisionState(null);
    },
  });

  const rejectCancellation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectCancellationRequest(id, { note }),
    onSuccess: (_res, vars) => {
      setPendingOverride({ key: pendingKey, pending: null });
      setLocalDecisionState({ key: pendingKey, value: { status: "REJECTED", note: vars.note } });
      setDecisionState(null);
      toast.success("Cancellation request rejected — the booking is unchanged.");
      invalidateBookingQueries();
    },
    onError: (err: unknown) => {
      toast.error(getCancellationErrorMessage(err, "Failed to reject cancellation request"));
      if (getCancellationErrorStatus(err) === 409) {
        setPendingOverride({ key: pendingKey, pending: null });
        invalidateBookingQueries();
      }
      setDecisionState(null);
    },
  });

  const decisionRequest: CancellationRequest | null = pending
    ? {
        id: pending.id,
        status: pending.status as CancellationStatus,
        bookingId: booking.id,
        booking: {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          currency: booking.currency,
          grossAmount: booking.grossAmount,
          travelDate: booking.travelDate,
        },
        tour: booking.tour
          ? { id: booking.tour.id, title: booking.tour.title, supplier: booking.tour.supplier }
          : null,
        preview: pending.preview ?? null,
        payload: pending.payload ?? null,
        stopSellingApplied: pending.stopSellingApplied,
        createdAt: pending.createdAt,
      }
    : null;

  const handleCancellationDecision = (note: string) => {
    if (!pending || !decisionMode) return;
    if (decisionMode === "approve") approveCancellation.mutate({ id: pending.id, note });
    else rejectCancellation.mutate({ id: pending.id, note });
  };

  const timelineSteps = [
    { label: "Booking Created", date: booking.createdAt, active: true },
    { label: "Payment Confirmed", date: booking.paidAt || null, active: isPaymentPaid(booking.paymentStatus) },
    { label: "Tour Completed", date: booking.status === "COMPLETED" ? booking.updatedAt : null, active: booking.status === "COMPLETED" },
    { label: "Payout Processed", date: booking.payouts?.[0]?.paidAt || null, active: booking.payouts?.[0]?.status === "PAID" },
  ];

  const numTravelers = travelerCount(booking.travelers);
  const commissionRate = Number(booking.commissionRate || 0) * 100;
  const canChargeNow =
    booking.paymentTiming === "later" &&
    booking.paymentStatus !== "SUCCEEDED" &&
    can("bookings.confirm-payment");
  const canConfirmPayment =
    booking.paymentTiming !== "later" &&
    booking.paymentStatus === "PENDING" &&
    can("bookings.confirm-payment");
  const bookingStatusMeta = BOOKING_STATUS_META[booking.status] || {
    label: humanizeStatus(booking.status),
    hint: "The current state of this booking.",
  };
  const paymentStatusMeta = PAYMENT_STATUS_META[booking.paymentStatus] || {
    label: humanizeStatus(booking.paymentStatus),
    hint: "The current state of the customer payment.",
  };
  const paymentHint =
    booking.paymentStatus === "PENDING" && booking.paymentTiming === "later"
      ? "The customer chose to pay later. Nothing has been charged yet."
      : paymentStatusMeta.hint;
  const paidWith = paymentSource(booking);

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-text-primary/30 motion-reduce:animate-none",
          closing
            ? "animate-out fade-out-0 duration-200 [animation-fill-mode:forwards]"
            : "animate-in fade-in-0 duration-200",
        )}
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-surface-base shadow-[-8px_0_24px_rgba(0,0,0,0.12)] motion-reduce:animate-none sm:w-[480px] lg:w-[560px]",
          closing
            ? "animate-out slide-out-to-right duration-200 ease-in [animation-fill-mode:forwards]"
            : "animate-in slide-in-from-right duration-300 ease-out",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Booking ${booking.bookingNumber}`}
      >
        <div className="shrink-0 border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-text-tertiary">Booking detail</p>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.01em] text-text-primary">
                {booking.bookingNumber}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={requestClose}
              aria-label="Close booking detail"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-surface-muted px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-text-tertiary">Total</p>
              <p className="tnum mt-0.5 truncate text-sm font-semibold text-text-primary">
                {formatCurrency(Number(booking.grossAmount), booking.currency)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-text-tertiary">Travel date</p>
              <p className="mt-0.5 truncate text-sm font-medium text-text-primary">
                {formatTravelDate(booking.travelDate)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-text-tertiary">Guests</p>
              <p className="tnum mt-0.5 text-sm font-medium text-text-primary">
                {numTravelers}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-7 p-6">
            <div>
              <SectionTitle>Status</SectionTitle>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <StatusTile
                  label="Booking"
                  status={booking.status}
                  value={bookingStatusMeta.label}
                  hint={bookingStatusMeta.hint}
                  icon={<CalendarCheck className="h-3 w-3" />}
                />
                <StatusTile
                  label="Payment"
                  status={booking.paymentStatus}
                  value={paymentStatusMeta.label}
                  hint={paymentHint}
                  icon={<CreditCard className="h-3 w-3" />}
                />
              </div>
            </div>

            <div className="flex items-start gap-4">
              {contact.hasAccount ? (
                <button
                  onClick={() => contact.accountId && requestViewCustomer(contact.accountId)}
                  className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-full"
                  title="View customer profile"
                >
                  {contactAvatar}
                </button>
              ) : (
                <div className="shrink-0" title="Booked without an account">
                  {contactAvatar}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="truncate text-sm font-semibold text-text-primary">{contact.name}</h3>
                  {contact.hasAccount && (
                    <button
                      type="button"
                      onClick={() => contact.accountId && requestViewCustomer(contact.accountId)}
                      className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      View profile <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {!contact.hasAccount && (
                  <p className="text-[11px] text-text-tertiary">Booked as a guest — no customer account</p>
                )}
                {contact.email && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </p>
                )}
                {contact.phone && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Phone className="h-3 w-3 shrink-0" />
                    {contact.phone}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate(`/admin/tours/${booking.tour.id}`)}
              className="w-full cursor-pointer space-y-1 rounded-xl border border-border bg-surface-base p-4 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden bg-surface-muted border border-border">
                  {booking.tour.coverPhoto ? (
                    <OptimizedImage src={booking.tour.coverPhoto} alt="" width={40} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{booking.tour.title}</p>
                  <p className="text-xs text-text-secondary">by {booking.tour.supplier.name}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-text-tertiary shrink-0" />
              </div>
            </button>

            <div>
              <SectionTitle>Booking Details</SectionTitle>
              <div className="space-y-0.5">
                <DetailRow icon={<Calendar className="h-3 w-3" />} label="Travel Date">
                  {formatTravelDate(booking.travelDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </DetailRow>
                {booking.selectedTime && (
                  <DetailRow icon={<Clock className="h-3 w-3" />} label="Time">
                    {booking.selectedTime}
                  </DetailRow>
                )}
                <DetailRow icon={<Users className="h-3 w-3" />} label="Travelers">
                  {numTravelers} {numTravelers === 1 ? "person" : "people"}
                </DetailRow>
                <DetailRow icon={<Hash className="h-3 w-3" />} label="Booking #">
                  {booking.bookingNumber}
                </DetailRow>
                {booking.source && (
                  <DetailRow icon={<Globe className="h-3 w-3" />} label="Source">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      sourceMeta(booking.source).className,
                    )}>
                      {sourceMeta(booking.source).label}
                    </span>
                  </DetailRow>
                )}
                <DetailRow icon={<Clock className="h-3 w-3" />} label="Created">
                  {timeAgo(booking.createdAt)}
                </DetailRow>
                {booking.paidAt && (
                  <DetailRow icon={<CheckCircle2 className="h-3 w-3" />} label="Paid At">
                    {new Date(booking.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </DetailRow>
                )}
              </div>
            </div>

            <div>
              <SectionTitle
                action={<span className="tnum text-[11px] font-medium text-text-tertiary">{numTravelers} total</span>}
              >
                Travelers
              </SectionTitle>
              <div className="space-y-3">
                <TravelerBreakdown travelers={booking.travelers} />
                {booking.travelers.details && booking.travelers.details.length > 0 && (
                  <TravelerManifest details={booking.travelers.details} />
                )}
                {(booking.travelers.phoneNumber || booking.travelers.location) && (
                  <div className="rounded-xl border border-border p-3 space-y-1.5">
                    {booking.travelers.phoneNumber && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Phone className="h-3 w-3" />
                        <span>{booking.travelers.phoneNumber}</span>
                      </div>
                    )}
                    {booking.travelers.location && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <MapPin className="h-3 w-3" />
                        <span>{booking.travelers.location}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(booking.leadTravelerName || booking.leadTravelerEmail || booking.leadTravelerPhone) && (
              <div>
                <SectionTitle>Lead Traveler</SectionTitle>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  {booking.leadTravelerName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-text-tertiary" />
                      <span className="text-sm font-medium text-text-primary">{booking.leadTravelerName}</span>
                    </div>
                  )}
                  {booking.leadTravelerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-text-tertiary" />
                      <a href={`mailto:${booking.leadTravelerEmail}`} className="text-xs text-primary hover:underline">{booking.leadTravelerEmail}</a>
                    </div>
                  )}
                  {booking.leadTravelerPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-text-tertiary" />
                      <a href={`tel:${booking.leadTravelerPhone}`} className="text-xs text-primary hover:underline">{booking.leadTravelerPhone}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {booking.pickup && (
              <div>
                <SectionTitle>Pickup Details</SectionTitle>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  {booking.pickup.pickupLater ? (
                    <div className="flex items-center gap-2 text-xs text-status-pending-text">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium">Customer will choose pickup location later</span>
                    </div>
                  ) : (
                    <>
                      {(booking.pickup.areaName || booking.pickup.locationName || booking.pickup.address?.name) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-text-primary">
                              {booking.pickup.address?.name || booking.pickup.locationName || booking.pickup.areaName}
                            </p>
                            {booking.pickup.address?.address && booking.pickup.address.address !== booking.pickup.address.name && (
                              <p className="text-[10px] text-text-tertiary mt-0.5">{booking.pickup.address.address}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {booking.pickup.time && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                          <span>Pickup at {booking.pickup.time}</span>
                        </div>
                      )}
                      {booking.pickup.instructions && (
                        <p className="text-[10px] text-text-tertiary bg-surface-muted rounded-xl p-2">{booking.pickup.instructions}</p>
                      )}
                    </>
                  )}
                  {booking.pickup.mode && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-tertiary">Mode:</span>
                      <span className="text-[10px] font-medium text-text-secondary capitalize">{booking.pickup.mode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <SectionTitle>Pricing</SectionTitle>
              <div className="rounded-xl border border-border p-4 space-y-0.5">
                <DetailRow icon={<Banknote className="h-3 w-3" />} label="Subtotal">
                  <span className="tnum">{formatCurrency(Number(booking.subtotal), booking.currency)}</span>
                </DetailRow>
                <DetailRow icon={<CreditCard className="h-3 w-3" />} label="Fees">
                  <span className="tnum">{formatCurrency(Number(booking.fees), booking.currency)}</span>
                </DetailRow>
                {Number(booking.discounts) > 0 && (
                  <DetailRow icon={<Percent className="h-3 w-3" />} label="Discounts">
                    <span className="text-status-rejected-text font-medium">
                      <span className="tnum">-{formatCurrency(Number(booking.discounts), booking.currency)}</span>
                    </span>
                    {booking.offerName && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-status-rejected/10 border border-status-rejected/30 text-[10px] font-medium text-status-rejected-text">
                        <Tag size={9} />
                        {booking.offerName}
                        {booking.offerPromoCode && (
                          <span className="ml-0.5 px-1 py-px rounded bg-status-rejected/10 text-status-rejected-text font-mono text-[9px]">
                            {booking.offerPromoCode}
                          </span>
                        )}
                      </span>
                    )}
                    {booking.offerDiscountType === 'PERCENTAGE' && booking.offerDiscountPct && (
                      <span className="ml-1 text-xs text-status-rejected-text">({booking.offerDiscountPct}% off)</span>
                    )}
                    {booking.offerDiscountType === 'FIXED' && booking.offerDiscountFix && (
                      <span className="ml-1 text-xs text-status-rejected-text">(-{formatCurrency(Number(booking.offerDiscountFix), booking.currency)} off)</span>
                    )}
                  </DetailRow>
                )}
                <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Total</span>
                  <span className="tnum text-sm font-semibold text-text-primary">
                    {formatCurrency(Number(booking.grossAmount), booking.currency)}
                  </span>
                </div>
              </div>
            </div>

            {commissionRate > 0 && (
              <div>
                <SectionTitle>Commission</SectionTitle>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Commission Rate</span>
                    <span className="text-xs font-medium text-text-primary tnum">{commissionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Platform Commission</span>
                    <span className="tnum text-xs font-medium text-text-primary">
                      {formatCurrency(Number(booking.platformCommission), booking.currency)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">Supplier Payout</span>
                    <span className="tnum text-xs font-semibold text-text-primary">
                      {formatCurrency(Number(booking.supplierPayout), booking.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <SectionTitle>Payment</SectionTitle>
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-text-tertiary" />
                    <span className="text-xs font-medium text-text-secondary">Payment Status</span>
                  </span>
                  <StatusChip status={booking.paymentStatus} label={paymentStatusMeta.label} />
                </div>
                {paidWith.hasEvidence && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {paidWith.provider === "PAYPAL" ? (
                        <Wallet className="h-4 w-4 text-text-tertiary" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-text-tertiary" />
                      )}
                      <span className="text-xs font-medium text-text-secondary">Payment Source</span>
                    </span>
                    <span className="text-xs font-medium text-text-primary">{paidWith.label}</span>
                  </div>
                )}
                {paidWith.card && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Card</span>
                    <span className="tnum text-xs font-medium text-text-primary">{paidWith.card}</span>
                  </div>
                )}
                {paidWith.reference && (
                  <div className="rounded-lg bg-surface-muted px-3 py-2">
                    <p className="text-[10px] text-text-tertiary">{paidWith.reference.label}</p>
                    <p className="mt-0.5 break-all font-mono text-[10px] text-text-secondary">
                      {paidWith.reference.value}
                    </p>
                  </div>
                )}
                {booking.paymentTiming === "later" && (
                  <div className="flex items-center gap-2 rounded-xl bg-status-pending/10 border border-status-pending/30 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-status-pending-text shrink-0" />
                    <span className="text-xs text-status-pending-text">
                      Reserve now, pay later — card on file, auto-charges before activity date
                    </span>
                  </div>
                )}
              </div>
            </div>

            {booking.payouts && booking.payouts.length > 0 && (
              <div>
                <SectionTitle>Payout</SectionTitle>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  {booking.payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Banknote className="h-4 w-4 text-text-tertiary shrink-0" />
                        <span className="tnum text-xs font-medium text-text-primary">
                          {formatCurrency(Number(payout.amount), payout.currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusChip status={payout.status} />
                        <button
                          onClick={() => navigate(`/admin/payouts?tab=list&payoutId=${payout.id}&payoutStatus=${payout.status}`)}
                          className="text-[10px] font-medium text-primary hover:text-primary/80 hover:underline whitespace-nowrap"
                        >
                          View Payout
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.specialRequests && (
              <div>
                <SectionTitle>Special Requests</SectionTitle>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs text-text-secondary">{booking.specialRequests}</p>
                </div>
              </div>
            )}

            {booking.cancellationReason && (
              <div>
                <SectionTitle>Cancellation Reason</SectionTitle>
                <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/10 p-3">
                  <p className="text-xs text-status-rejected-text">
                    {booking.cancellationReasonLabel || booking.cancellationReason}
                  </p>
                </div>
              </div>
            )}

            {(pending || localDecision || booking.cancelledAt || booking.cancellationCode) && (
              <div>
                <SectionTitle>Cancellation</SectionTitle>
                <div className="rounded-xl border border-border p-4 space-y-3">
                  {pending ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <CancellationStatusBadge status={pending.status} />
                        <span className="text-[10px] text-text-tertiary">requested {timeAgo(pending.createdAt)}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-text-secondary">Category</span>
                          <span className="font-medium text-text-primary">
                            {pending.categoryLabel
                              || cancellationCategoryLabel(pending.payload?.cancellationCategory || booking.cancellationCategory)
                              || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-text-secondary">Reason</span>
                          <span className="text-right font-medium text-text-primary">
                            {pending.reasonLabel
                              || cancellationReasonLabel(pending.payload?.cancellationCode)
                              || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-text-secondary">
                            <Banknote className="h-3 w-3" /> Full refund preview
                          </span>
                          <span className="font-semibold text-text-primary">
                            {formatCurrency(pending.preview?.refund?.amount ?? 0, booking.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-text-secondary">
                            <Percent className="h-3 w-3" /> Fee (up to 25%)
                          </span>
                          <span className="text-text-primary">{formatCurrency(pending.preview?.fee ?? 0, booking.currency)}</span>
                        </div>
                        {pending.stopSellingApplied && (
                          <p className="flex items-center gap-1.5 text-[11px] text-status-pending-text">
                            <ShieldAlert className="h-3.5 w-3.5" /> Dates blocked from selling at request time
                          </p>
                        )}
                      </div>
                      {pending.payload?.explanation && (
                        <p className="whitespace-pre-wrap rounded-xl bg-surface-muted p-2 text-[11px] text-text-secondary">
                          {String(pending.payload.explanation)}
                        </p>
                      )}
                      <p className="text-[11px] text-text-tertiary">
                        Nothing has changed on this booking yet — approving executes the full refund
                        {pending.preview?.fee ? " and a cancellation fee" : " path"}.
                      </p>
                      {canDecideCancellation ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 border-status-rejected/40 text-status-rejected-text hover:bg-status-rejected/10"
                            onClick={() => setDecisionState({ key: pendingKey, mode: "reject" })}
                            disabled={approveCancellation.isPending || rejectCancellation.isPending}
                          >
                            <Ban className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => setDecisionState({ key: pendingKey, mode: "approve" })}
                            disabled={approveCancellation.isPending || rejectCancellation.isPending}
                          >
                            <ShieldAlert className="h-3.5 w-3.5" /> Approve & refund
                          </Button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-text-tertiary">
                          You can view this request but need{" "}
                          <span className="font-medium text-text-secondary">cancellations.approve</span> to decide.
                        </p>
                      )}
                    </>
                  ) : localDecision ? (
                    <div
                      className={cn(
                        "rounded-xl border p-3",
                        localDecision.status === "APPROVED"
                          ? "border-status-active/30 bg-status-active/5"
                          : "border-status-rejected/30 bg-status-rejected/5",
                      )}
                    >
                      <p className="text-xs font-semibold text-text-primary">
                        {localDecision.status === "APPROVED"
                          ? "Approved — refund executed"
                          : "Rejected — booking unchanged"}
                      </p>
                      {localDecision.status === "APPROVED" && (
                        <p className="mt-1 text-[11px] text-text-secondary">
                          Refund {formatCurrency(localDecision.refundAmount ?? 0, booking.currency)} · fee{" "}
                          {formatCurrency(localDecision.fee ?? 0, booking.currency)}
                        </p>
                      )}
                      {localDecision.note ? (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-text-tertiary">{localDecision.note}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {booking.cancellationCode && (
                        <DetailRow icon={<Tag className="h-3 w-3" />} label="Reason">
                          {booking.cancellationCodeLabel || cancellationReasonLabel(booking.cancellationCode)}
                        </DetailRow>
                      )}
                      {booking.cancellationCategory && (
                        <DetailRow icon={<Tag className="h-3 w-3" />} label="Category">
                          {booking.cancellationCategoryLabel || cancellationCategoryLabel(booking.cancellationCategory)}
                        </DetailRow>
                      )}
                      {booking.cancellationOrigin && (
                        <DetailRow icon={<Globe className="h-3 w-3" />} label="Origin">
                          <span className="capitalize">{String(booking.cancellationOrigin).replace(/_/g, " ").toLowerCase()}</span>
                        </DetailRow>
                      )}
                      {booking.countsTowardRate != null && (
                        <DetailRow icon={<ShieldAlert className="h-3 w-3" />} label="Counts toward rate">
                          {booking.countsTowardRate ? "Yes" : "No"}
                        </DetailRow>
                      )}
                      <DetailRow icon={<Percent className="h-3 w-3" />} label="Fee">
                        {formatCurrency(booking.cancellationFee, booking.currency)}
                      </DetailRow>
                      <DetailRow icon={<Banknote className="h-3 w-3" />} label="Refund status">
                        {booking.refundStatus || "—"}
                      </DetailRow>
                      <DetailRow icon={<Banknote className="h-3 w-3" />} label="Refund amount">
                        {formatCurrency(booking.refundAmount, booking.currency)}
                      </DetailRow>
                      {booking.cancelledAt && (
                        <DetailRow icon={<Calendar className="h-3 w-3" />} label="Cancelled at">
                          {formatDateTime(booking.cancelledAt)}
                        </DetailRow>
                      )}
                      {booking.cancellationChoiceDeadline && (
                        <DetailRow icon={<Clock className="h-3 w-3" />} label="Choice deadline">
                          {formatDateTime(booking.cancellationChoiceDeadline)}
                        </DetailRow>
                      )}
                      {booking.customerChoice && (
                        <DetailRow icon={<User className="h-3 w-3" />} label="Customer choice">
                          <span className="capitalize">
                            {String(booking.customerChoice).replace(/_/g, " ").toLowerCase()}
                          </span>
                        </DetailRow>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <SectionTitle>Timeline</SectionTitle>
              <div className="rounded-xl border border-border p-4">
                <BookingTimeline steps={timelineSteps} />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface-base p-4">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={requestClose}>
              Close
            </Button>
            {canChargeNow && (
              <Button
                className="flex-1 bg-status-pending text-white hover:bg-status-pending/90"
                onClick={() => onChargeNow(booking)}
              >
                <Zap className="h-3.5 w-3.5" />
                Charge now
              </Button>
            )}
            {canConfirmPayment && (
              <Button className="flex-1" onClick={() => onConfirmPayment(booking)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {decisionMode && decisionRequest && (
        <CancellationDecisionDialog
          open
          mode={decisionMode}
          request={decisionRequest}
          loading={approveCancellation.isPending || rejectCancellation.isPending}
          onCancel={() => setDecisionState(null)}
          onConfirm={handleCancellationDecision}
        />
      )}
    </>,
    document.body
  );
}