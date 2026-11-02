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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            Confirm Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-2">
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
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Total</span>
              <span className="text-base font-semibold text-text-primary">
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

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-primary">
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
            className="bg-primary hover:bg-primary text-primary-foreground"
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