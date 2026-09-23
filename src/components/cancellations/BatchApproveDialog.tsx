import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  BatchApproveResult,
  CancellationRequest,
} from "@/services/cancellationService";

interface BatchApproveDialogProps {
  open: boolean;
  requests: CancellationRequest[];
  loading: boolean;
  results: BatchApproveResult | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

/**
 * Batch approve confirmation + per-request result summary. Batch approve is
 * never all-or-nothing: each id reports its own ok/error from the response.
 */
export function BatchApproveDialog({
  open,
  requests,
  loading,
  results,
  onCancel,
  onConfirm,
}: BatchApproveDialogProps) {
  const [note, setNote] = useState("");

  const showResults = !!results;
  const currency = requests[0]?.booking?.currency || "USD";
  const totalRefund = requests.reduce((sum, r) => sum + (r.preview?.refund?.amount ?? 0), 0);
  const byId = new Map(requests.map((r) => [r.id, r]));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showResults ? (
              results.failed > 0 ? (
                <AlertTriangle className="h-5 w-5 text-status-pending" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-status-active" />
              )
            ) : (
              <AlertTriangle className="h-5 w-5 text-status-pending" />
            )}
            {showResults ? "Batch approve complete" : `Approve ${requests.length} request${requests.length === 1 ? "" : "s"}`}
          </DialogTitle>
          <DialogDescription>
            {showResults
              ? `${results.approved} approved · ${results.failed} failed`
              : "Approving executes a full refund to each customer and may apply a 25% fee. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {showResults ? (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {results.results.map((r) => {
              const req = byId.get(r.id);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3",
                    r.ok ? "border-status-active/30 bg-status-active/5" : "border-status-rejected/30 bg-status-rejected/5",
                  )}
                >
                  {r.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-active" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-rejected" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-text-primary">
                      {req?.booking?.bookingNumber || r.id}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {r.ok
                        ? `Approved · refund ${formatCurrency(req?.preview?.refund?.amount ?? 0, currency)}`
                        : r.error || "Failed"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-[30vh] space-y-1.5 overflow-y-auto rounded-lg border border-border bg-surface-muted/40 p-3">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-text-primary">
                    {r.booking?.bookingNumber || r.id}
                  </span>
                  <span className="shrink-0 text-text-secondary">
                    {formatCurrency(r.preview?.refund?.amount ?? 0, r.booking?.currency || currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-status-pending/10 px-3 py-2 text-xs">
              <span className="font-medium text-text-secondary">Total full refund</span>
              <span className="font-semibold text-text-primary">{formatCurrency(totalRefund, currency)}</span>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="batch-approve-note" className="text-xs font-medium text-text-primary">
                Decision note (optional, applied to all)
              </label>
              <Textarea
                id="batch-approve-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add context for the audit trail"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {showResults ? (
            <Button onClick={onCancel} className="w-full sm:w-auto">Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
              <Button onClick={() => onConfirm(note.trim())} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve {requests.length}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
