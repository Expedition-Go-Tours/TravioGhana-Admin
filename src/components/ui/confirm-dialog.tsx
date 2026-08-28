import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  loading?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, onConfirm, title, description, confirmLabel = "Confirm", confirmVariant = "destructive", loading }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[#5d5b54] py-2">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>{loading ? `${confirmLabel}...` : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}