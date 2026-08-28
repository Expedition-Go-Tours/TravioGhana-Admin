import { useState } from "react";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Booking } from "@/types/booking";

interface ConfirmPaymentDialogProps {
  booking: Booking;
  isPending: boolean;
  onConfirm: (reference?: string) => void;
  onClose: () => void;
}

export function ConfirmPaymentDialog({ booking, isPending, onConfirm, onClose }: ConfirmPaymentDialogProps) {
  const [reference, setReference] = useState("");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
              <Receipt className="h-4 w-4 text-emerald-600" />
            </div>
            Confirm Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Booking</span>
              <span className="font-medium text-text-primary">#{booking.bookingNumber}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Customer</span>
              <span className="font-medium text-text-primary">{booking.customer.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Tour</span>
              <span className="font-medium text-text-primary truncate ml-4">{booking.tour.title}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-base font-bold text-slate-900">
                {booking.currency} {Number(booking.grossAmount).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference" className="text-xs text-text-secondary">
              Payment Reference <span className="text-text-tertiary">(optional)</span>
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction ID, receipt number..."
              className="h-9"
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700">
              This will mark the booking as paid and confirm it. The supplier will be notified
              and the payout process will be initiated.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(reference || undefined)}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Confirming...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Payment</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
