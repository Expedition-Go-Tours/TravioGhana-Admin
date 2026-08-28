import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ExitConfirmDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function ExitConfirmDialog({ open, onStay, onLeave }: ExitConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onStay(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          You have unsaved changes. Are you sure you want to leave?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onStay}>Stay</Button>
          <Button variant="destructive" onClick={onLeave}>Leave</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
