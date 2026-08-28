import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  confirmDisabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  icon?: "publish" | "unpublish" | "danger" | "warning";
}

const iconConfig = {
  publish: {
    icon: CheckCircle,
    bg: "bg-green-100",
    color: "text-status-active",
  },
  unpublish: {
    icon: XCircle,
    bg: "bg-red-100",
    color: "text-red-500",
  },
  danger: {
    icon: AlertTriangle,
    bg: "bg-red-100",
    color: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-100",
    color: "text-amber-600",
  },
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  confirmDisabled = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
  icon,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, loading, onCancel]);

  const ic = icon ? iconConfig[icon] : null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !loading) onCancel(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader className="text-center sm:text-center">
            {ic && (
              <div className="mb-4 flex justify-center">
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", ic.bg)}>
                  <ic.icon className={cn("h-7 w-7", ic.color)} />
                </div>
              </div>
            )}
            <DialogTitle className="text-lg font-semibold text-text-primary text-center">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-text-secondary mt-2 leading-relaxed text-center">
              {description}
            </DialogDescription>
          </DialogHeader>
          {children && <div className="mt-4">{children}</div>}
        </div>
        <DialogFooter className="px-6 py-4 bg-surface-muted/80 border-t border-border/60 gap-2.5">
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 sm:flex-none h-10 text-sm font-medium"
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={cn(
              "flex-1 sm:flex-none h-10 text-sm font-semibold gap-2",
              confirmVariant === "destructive" && "bg-red-600 hover:bg-red-700 text-white shadow-sm"
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
