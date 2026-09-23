import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Hash,
  CreditCard,
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
import { cn, timeAgo, getStatusColor, formatCurrency, formatDateTime } from "@/lib/utils";
import { BookingTimeline } from "./BookingTimeline";
import type { Booking, TravelerData } from "@/types/booking";
import { isPaymentPaid, travelerCount } from "@/types/booking";
import OptimizedImage from "@/components/shared/OptimizedImage";
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
// The DB stores these as uppercase enum values (EXPEDITION / GHANA /
// TRAVIO_AFRICA); TRAVIO is a legacy value from seed data only.
const SOURCE_META: Record<string, { label: string; className: string }> = {
  EXPEDITION: { label: "Expedition Go", className: "bg-emerald-50 text-emerald-700" },
  GHANA: { label: "Travio Ghana", className: "bg-yellow-50 text-yellow-700" },
  TRAVIO_AFRICA: { label: "Travio Africa", className: "bg-sky-50 text-sky-700" },
};
const sourceMeta = (source: string) =>
  SOURCE_META[String(source).toUpperCase()] || { label: source, className: "bg-gray-50 text-gray-600" };

interface BookingDetailPanelProps {
  booking: Booking;
  onClose: () => void;
  onConfirmPayment: (booking: Booking) => void;
  onChargeNow: (booking: Booking) => void;
  onViewCustomer: (customerId: string) => void;
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        getStatusColor(status),
      )}
    >
      {status}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xs font-medium text-text-primary text-right">{children}</div>
    </div>
  );
}

function TravelerBreakdown({ travelers }: { travelers: TravelerData }) {
  const categories = [
    { label: "Adults", count: travelers.adults || 0, icon: <User className="h-3.5 w-3.5" /> },
    { label: "Children", count: travelers.children || 0, icon: <PersonStanding className="h-3.5 w-3.5" /> },
    { label: "Infants", count: travelers.infants || 0, icon: <Baby className="h-3.5 w-3.5" /> },
    { label: "Seniors", count: travelers.seniors || 0, icon: <Users className="h-3.5 w-3.5" /> },
  ].filter((c) => c.count > 0);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <div key={cat.label} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-base px-2.5 py-1.5">
          <span className="text-text-tertiary">{cat.icon}</span>
          <span className="text-xs font-semibold text-text-primary">{cat.count}</span>
          <span className="text-xs text-text-secondary">{cat.label}</span>
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
          <tr className="bg-surface-muted/50 border-b border-border">
            <th className="px-3 py-2 text-left font-semibold text-text-secondary">#</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary">Name</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary">Age</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary">Category</th>
          </tr>
        </thead>
        <tbody>
          {details.map((t, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2 text-text-tertiary">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-text-primary">{t.name || "—"}</td>
              <td className="px-3 py-2 text-text-secondary">{t.age ?? "—"}</td>
              <td className="px-3 py-2">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  t.ageGroup === "adult" && "bg-blue-50 text-blue-700",
                  t.ageGroup === "child" && "bg-amber-50 text-amber-700",
                  t.ageGroup === "infant" && "bg-pink-50 text-pink-700",
                  t.ageGroup === "senior" && "bg-purple-50 text-purple-700",
                  !t.ageGroup && "bg-gray-50 text-gray-500",
                )}>
                  {t.ageGroup || "—"}
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

  return createPortal(
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
        className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] md:w-[480px] bg-surface-base border-l border-border shadow-[-4px_0_16px_rgba(0,0,0,0.06)] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Booking Detail</p>
            <h2 className="text-base font-semibold text-text-primary truncate mt-0.5">{booking.bookingNumber}</h2>
            <div className="flex items-center gap-1.5 mt-2">
              <StatusChip status={booking.status} />
              <StatusChip status={booking.paymentStatus} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-4">
              <button
                onClick={() => onViewCustomer(booking.customer.id)}
                className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-full"
                title="View customer profile"
              >
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-base font-bold text-primary ring-2 ring-primary/10">
                  {booking.customer.photoURL ? (
                    <OptimizedImage src={booking.customer.photoURL} alt="" width={48} className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <span className={booking.customer.photoURL ? "opacity-0" : ""}>
                    {(booking.customer.name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-sm font-semibold text-text-primary truncate">{booking.customer.name}</h3>
                {booking.customer.email && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{booking.customer.email}</span>
                  </p>
                )}
                {booking.customer.phone && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Phone className="h-3 w-3 shrink-0" />
                    {booking.customer.phone}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate(`/admin/tours/${booking.tour.id}`)}
              className="w-full rounded-xl border border-border bg-surface-base p-4 space-y-1 text-left cursor-pointer hover:border-primary/40 hover:shadow-tinted transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden bg-surface-muted border border-border">
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
                  {new Date(booking.travelDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
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
              <SectionTitle>Travelers</SectionTitle>
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
                    <div className="flex items-center gap-2 text-xs text-amber-600">
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
                        <p className="text-[10px] text-text-tertiary bg-surface-muted/50 rounded-lg p-2">{booking.pickup.instructions}</p>
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
                  {booking.currency} {Number(booking.subtotal).toLocaleString()}
                </DetailRow>
                <DetailRow icon={<CreditCard className="h-3 w-3" />} label="Fees">
                  {booking.currency} {Number(booking.fees).toLocaleString()}
                </DetailRow>
                {Number(booking.discounts) > 0 && (
                  <DetailRow icon={<Percent className="h-3 w-3" />} label="Discounts">
                    <span className="text-red-600 font-medium">
                      -{booking.currency} {Number(booking.discounts).toLocaleString()}
                    </span>
                    {booking.offerName && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-red-50 border border-red-200/60 text-[10px] font-medium text-red-700">
                        <Tag size={9} />
                        {booking.offerName}
                        {booking.offerPromoCode && (
                          <span className="ml-0.5 px-1 py-px rounded bg-red-100 text-red-800 font-mono text-[9px]">
                            {booking.offerPromoCode}
                          </span>
                        )}
                      </span>
                    )}
                    {booking.offerDiscountType === 'PERCENTAGE' && booking.offerDiscountPct && (
                      <span className="ml-1 text-xs text-red-600">({booking.offerDiscountPct}% off)</span>
                    )}
                    {booking.offerDiscountType === 'FIXED' && booking.offerDiscountFix && (
                      <span className="ml-1 text-xs text-red-600">(-{booking.currency} {booking.offerDiscountFix} off)</span>
                    )}
                  </DetailRow>
                )}
                <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Total</span>
                  <span className="text-sm font-bold text-text-primary tabular-nums">
                    {booking.currency} {Number(booking.grossAmount).toLocaleString()}
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
                    <span className="text-xs font-medium text-text-primary tabular-nums">{commissionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Platform Commission</span>
                    <span className="text-xs font-medium text-text-primary tabular-nums">
                      {booking.currency} {Number(booking.platformCommission).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">Supplier Payout</span>
                    <span className="text-xs font-semibold text-text-primary tabular-nums">
                      {booking.currency} {Number(booking.supplierPayout).toLocaleString()}
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
                  <StatusChip status={booking.paymentStatus} />
                </div>
                {booking.paymentTiming === "later" && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700">
                      Reserve now, pay later — card on file, auto-charges before activity date
                    </span>
                  </div>
                )}
                {booking.paymentTiming === "later" && booking.paymentStatus !== "SUCCEEDED" && can('bookings.confirm-payment') && (
                  <Button
                    onClick={() => onChargeNow(booking)}
                    size="sm"
                    className="w-full h-8 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Charge Now
                  </Button>
                )}
                {booking.paymentTiming !== "later" && booking.paymentStatus === "PENDING" && can('bookings.confirm-payment') && (
                  <Button
                    onClick={() => onConfirmPayment(booking)}
                    size="sm"
                    className="w-full h-8"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm Payment
                  </Button>
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
                        <span className="text-xs font-medium text-text-primary">
                          {payout.currency} {Number(payout.amount).toLocaleString()}
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
                <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
                  <p className="text-xs text-text-secondary">{booking.specialRequests}</p>
                </div>
              </div>
            )}

            {booking.cancellationReason && (
              <div>
                <SectionTitle>Cancellation Reason</SectionTitle>
                <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/10 p-3">
                  <p className="text-xs text-status-rejected">{booking.cancellationReason}</p>
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
                          <span className="font-medium capitalize text-text-primary">
                            {(pending.payload?.cancellationCategory || booking.cancellationCategory || "—")
                              .toString()
                              .replace(/_/g, " ")
                              .toLowerCase()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-text-secondary">Code</span>
                          <span className="font-mono text-text-primary">
                            {pending.payload?.cancellationCode || "—"}
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
                          <p className="flex items-center gap-1.5 text-[11px] text-status-pending">
                            <ShieldAlert className="h-3.5 w-3.5" /> Dates blocked from selling at request time
                          </p>
                        )}
                      </div>
                      {pending.payload?.explanation && (
                        <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/60 p-2 text-[11px] text-text-secondary">
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
                            className="flex-1 gap-1.5 border-status-rejected/40 text-status-rejected hover:bg-status-rejected/10"
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
                        "rounded-lg border p-3",
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
                        <DetailRow icon={<Tag className="h-3 w-3" />} label="Code">
                          <span className="font-mono">{booking.cancellationCode}</span>
                        </DetailRow>
                      )}
                      {booking.cancellationCategory && (
                        <DetailRow icon={<Tag className="h-3 w-3" />} label="Category">
                          <span className="capitalize">{String(booking.cancellationCategory).replace(/_/g, " ").toLowerCase()}</span>
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
      </motion.div>

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
