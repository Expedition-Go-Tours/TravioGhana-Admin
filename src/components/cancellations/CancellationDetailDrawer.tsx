import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Calendar,
  Clock,
  Hash,
  Store,
  User,
  Mail,
  Ban,
  CircleDollarSign,
  Percent,
  ShieldCheck,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CancellationStatusBadge } from "./CancellationStatusBadge";
import { getCancellationRequest } from "@/services/cancellationService";
import type { CancellationRequest } from "@/services/cancellationService";
import { cn, formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";

interface CancellationDetailDrawerProps {
  requestId: string | null;
  canDecide: boolean;
  onClose: () => void;
  onApprove: (request: CancellationRequest) => void;
  onReject: (request: CancellationRequest) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-text-secondary">{label}</span>
      <span className="text-right text-xs font-medium text-text-primary">{children}</span>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right text-xs font-medium text-text-primary">{children}</div>
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="space-y-5 p-5">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export function CancellationDetailDrawer({
  requestId,
  canDecide,
  onClose,
  onApprove,
  onReject,
}: CancellationDetailDrawerProps) {
  const { data: request, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "cancellation-request", requestId],
    queryFn: () => getCancellationRequest(requestId as string),
    enabled: !!requestId,
    refetchOnWindowFocus: false,
  });

  if (!requestId) return null;

  const booking = request?.booking;
  const currency = booking?.currency || "USD";
  const preview = request?.preview;
  const payload = request?.payload;
  const isDecidable =
    !!request && (request.status === "PENDING_APPROVAL" || request.status === "APPROVING");

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-surface-base shadow-[-4px_0_16px_rgba(0,0,0,0.08)] sm:w-[480px] md:w-[540px]"
        aria-label="Cancellation request detail"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Cancellation Request
            </p>
            <h2 className="mt-0.5 truncate font-mono text-base font-semibold text-text-primary">
              {booking?.bookingNumber || requestId}
            </h2>
            {request && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CancellationStatusBadge status={request.status} />
                {(request.reminderCount ?? 0) > 0 && (
                  <span className="text-[10px] text-text-tertiary">reminded ×{request.reminderCount}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <RequestSkeleton />
          ) : isError || !request ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-status-rejected" />
              <p className="text-sm text-text-secondary">Failed to load this request</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {/* Booking + tour */}
              <div className="rounded-xl border border-border p-4">
                <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Booking">
                  <span className="font-mono">{booking?.bookingNumber || "—"}</span>
                </InfoRow>
                <InfoRow icon={<Store className="h-3.5 w-3.5" />} label="Tour">
                  {request.tour?.title || "—"}
                </InfoRow>
                <InfoRow icon={<Store className="h-3.5 w-3.5" />} label="Supplier">
                  {request.supplier?.name || request.tour?.supplier?.name || "—"}
                </InfoRow>
                <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Activity date">
                  {booking?.travelDate ? formatDateTime(booking.travelDate) : "—"}
                  {booking?.selectedTime ? <span className="block text-text-tertiary">{booking.selectedTime}</span> : null}
                </InfoRow>
                <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Requested">
                  {timeAgo(request.createdAt)}
                  <span className="block text-text-tertiary">{formatDateTime(request.createdAt)}</span>
                </InfoRow>
              </div>

              {/* Customer */}
              <div>
                <SectionTitle>Customer</SectionTitle>
                <div className="rounded-xl border border-border p-4">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Name">
                    {booking?.customer?.name || "—"}
                  </InfoRow>
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                    {booking?.customer?.email || "—"}
                  </InfoRow>
                  <InfoRow icon={<CircleDollarSign className="h-3.5 w-3.5" />} label="Booking total">
                    {formatCurrency(booking?.grossAmount, currency)}
                  </InfoRow>
                  <InfoRow icon={<Ban className="h-3.5 w-3.5" />} label="Booking status">
                    {booking?.status || "—"}
                  </InfoRow>
                </div>
              </div>

              {/* Category + reason */}
              <div>
                <SectionTitle>Request reason</SectionTitle>
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <Field label="Category">
                    <span className="capitalize">
                      {(payload?.cancellationCategory || booking?.cancellationCategory || "—").toString().replace(/_/g, " ").toLowerCase()}
                    </span>
                  </Field>
                  <Field label="Code">
                    <span className="font-mono">{payload?.cancellationCode || booking?.cancellationCode || "—"}</span>
                  </Field>
                  <Field label="Counts toward rate">
                    {preview?.countsTowardRate ?? booking?.countsTowardRate ? "Yes" : "No"}
                  </Field>
                  {payload?.explanation ? (
                    <div className="rounded-lg bg-surface-muted/60 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        <MessageSquare className="h-3 w-3" /> Supplier explanation
                      </p>
                      <p className="whitespace-pre-wrap text-xs text-text-secondary">{String(payload.explanation)}</p>
                    </div>
                  ) : null}
                  {payload?.supplierNotes ? (
                    <div className="rounded-lg bg-surface-muted/60 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        <FileText className="h-3 w-3" /> Supplier notes
                      </p>
                      <p className="whitespace-pre-wrap text-xs text-text-secondary">{String(payload.supplierNotes)}</p>
                    </div>
                  ) : null}
                  {payload?.evidenceUrl ? (
                    <a
                      href={String(payload.evidenceUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View evidence
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Money preview */}
              <div>
                <SectionTitle>Refund preview</SectionTitle>
                <div className="rounded-xl border border-border p-4">
                  <InfoRow icon={<CircleDollarSign className="h-3.5 w-3.5" />} label="Full refund to customer">
                    <span className="text-sm font-semibold">{formatCurrency(preview?.refund?.amount ?? 0, currency)}</span>
                  </InfoRow>
                  <InfoRow icon={<Percent className="h-3.5 w-3.5" />} label="Cancellation fee (up to 25%)">
                    {formatCurrency(preview?.fee ?? 0, currency)}
                  </InfoRow>
                  {preview?.refund?.note ? (
                    <p className="mt-2 rounded-lg bg-surface-muted/60 p-2 text-[11px] text-text-tertiary">
                      {preview.refund.note}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Stop selling */}
              <div>
                <SectionTitle>Stop-selling</SectionTitle>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <ShieldCheck className="h-3.5 w-3.5" /> Dates blocked at request time
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        request.stopSellingApplied
                          ? "bg-status-pending/10 text-status-pending"
                          : "bg-surface-muted text-text-tertiary",
                      )}
                    >
                      {request.stopSellingApplied ? "Applied" : "Not applied"}
                    </span>
                  </div>
                  {preview?.stopSell?.blocked?.length ? (
                    <p className="mt-2 text-[11px] text-text-tertiary">
                      {preview.stopSell.blocked.length} date(s) blocked
                      {preview.stopSell.blocked.length <= 12
                        ? `: ${preview.stopSell.blocked.map((b) => b.date).join(", ")}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Decision */}
              {(request.decidedAt || request.decidedBy || request.decisionNote) && (
                <div>
                  <SectionTitle>Decision</SectionTitle>
                  <div className="rounded-xl border border-border p-4">
                    <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Decided by">
                      {request.decidedBy?.name || request.decidedBy?.email || "—"}
                    </InfoRow>
                    <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Decided at">
                      {request.decidedAt ? formatDateTime(request.decidedAt) : "—"}
                    </InfoRow>
                    {request.decisionNote ? (
                      <div className="mt-2 rounded-lg bg-surface-muted/60 p-3">
                        <p className="whitespace-pre-wrap text-xs text-text-secondary">{request.decisionNote}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Cancelled booking outcome */}
              {booking?.cancelledAt ? (
                <div>
                  <SectionTitle>Cancellation outcome</SectionTitle>
                  <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 p-4">
                    <Field label="Cancelled at">{formatDateTime(booking.cancelledAt)}</Field>
                    <Field label="Refund status">{booking.refundStatus || "—"}</Field>
                    <Field label="Refund amount">{formatCurrency(booking.refundAmount, currency)}</Field>
                    <Field label="Fee">{formatCurrency(booking.cancellationFee, currency)}</Field>
                    <Field label="Customer choice deadline">
                      {booking.cancellationChoiceDeadline ? formatDateTime(booking.cancellationChoiceDeadline) : "—"}
                    </Field>
                    <Field label="Customer choice">{booking.customerChoice || "—"}</Field>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {request && isDecidable && canDecide && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-status-rejected/40 text-status-rejected hover:bg-status-rejected/10"
              onClick={() => onReject(request)}
            >
              <Ban className="h-4 w-4" /> Reject
            </Button>
            <Button className="flex-1 gap-1.5" onClick={() => onApprove(request)}>
              <ShieldCheck className="h-4 w-4" /> Approve & refund
            </Button>
          </div>
        )}

        {request && isDecidable && !canDecide && (
          <div className="shrink-0 border-t border-border px-5 py-3 text-center text-[11px] text-text-tertiary">
            You can view this request but need <span className="font-medium text-text-secondary">cancellations.approve</span> to decide.
          </div>
        )}
      </motion.aside>
    </>,
    document.body,
  );
}
