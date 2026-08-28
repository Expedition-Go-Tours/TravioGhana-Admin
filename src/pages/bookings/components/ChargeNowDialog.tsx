import { Zap, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Booking } from "@/types/booking";

interface ChargeNowDialogProps {
  booking: Booking;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ChargeNowDialog({ booking, isPending, onConfirm, onClose }: ChargeNowDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            Charge Customer Card
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
              <span className="text-sm font-semibold text-slate-900">Amount</span>
              <span className="text-base font-bold text-slate-900">
                {booking.currency} {Number(booking.grossAmount).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              This will immediately charge the customer's card on file. The booking
              will be confirmed and the supplier notified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Charging...</>
            ) : (
              <><Zap className="h-4 w-4 mr-1.5" />Charge Now</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
