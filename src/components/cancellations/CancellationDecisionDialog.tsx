import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { CancellationRequest } from "@/services/cancellationService";

interface CancellationDecisionDialogProps {
  open: boolean;
  mode: "approve" | "reject";
  request: CancellationRequest | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

/**
 * Confirm dialog for a single cancellation decision. Copy is deliberately
 * explicit about money and booking side-effects (plan principle: admins must
 * be absolutely aware). Approving executes a full refund + possible 25% fee;
 * rejecting leaves the booking untouched and re-opens blocked dates.
 */
export function CancellationDecisionDialog({
  open,
  mode,
  request,
  loading = false,
  onCancel,
  onConfirm,
}: CancellationDecisionDialogProps) {
  const [note, setNote] = useState("");

  const isReject = mode === "reject";
  const currency = request?.booking?.currency || "USD";
  const refundAmount = request?.preview?.refund?.amount ?? 0;
  const fee = request?.preview?.fee ?? 0;
  const bookingNumber = request?.booking?.bookingNumber;

  const trimmed = note.trim();
  const rejectInvalid = isReject && trimmed.length < 3;

  const subject = bookingNumber ? (
    <>
      Booking <span className="font-mono font-semibold text-text-primary">#{bookingNumber}</span>
      {request?.tour?.title ? <> · {request.tour.title}</> : null}
    </>
  ) : (
    "This cancellation request"
  );

  return (
    <ConfirmModal
      open={open}
      title={isReject ? "Reject cancellation request" : "Approve cancellation request"}
      confirmLabel={isReject ? "Reject request" : "Approve & refund"}
      confirmVariant={isReject ? "destructive" : "default"}
      icon={isReject ? "unpublish" : "warning"}
      loading={loading}
      confirmDisabled={rejectInvalid}
      onCancel={onCancel}
      onConfirm={() => onConfirm(trimmed)}
      description={subject}
    >
      <div className="space-y-3 text-left">
        {isReject ? (
          <div className="flex items-start gap-2 rounded-lg border border-status-rejected/30 bg-status-rejected/10 px-3 py-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-rejected" />
            <p className="text-xs text-text-secondary">
              Rejecting <strong className="text-text-primary">changes nothing on the booking</strong> — the
              trip stays confirmed and any dates blocked by the request are re-opened for selling. The supplier
              is notified with your reason.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-status-pending/40 bg-status-pending/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-pending" />
            <div className="space-y-1 text-xs text-text-secondary">
              <p>
                Approving <strong className="text-text-primary">executes a full refund</strong> to the customer
                of <strong className="text-text-primary">{formatCurrency(refundAmount, currency)}</strong>.
              </p>
              <p>
                A cancellation fee of up to <strong className="text-text-primary">25%</strong>
                {fee > 0 ? <> ({formatCurrency(fee, currency)})</> : null} may be applied. This cannot be undone.
              </p>
              <p>Nothing has moved on this booking yet.</p>
            </div>
          </div>
        )}

        {isReject ? (
          <div className="space-y-1.5">
            <label
              htmlFor="cancellation-reject-note"
              className="flex items-center gap-1.5 text-xs font-medium text-text-primary"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-text-tertiary" />
              Reason (required, min 3 characters)
            </label>
            <Textarea
              id="cancellation-reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Explain why this request is being rejected"
              autoFocus
            />
            {rejectInvalid && (
              <p className="text-[11px] text-status-rejected">A reason is required before rejecting.</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="cancellation-approve-note" className="text-xs font-medium text-text-primary">
              Decision note (optional)
            </label>
            <Textarea
              id="cancellation-approve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add context for the audit trail"
            />
          </div>
        )}
      </div>
    </ConfirmModal>
  );
}
