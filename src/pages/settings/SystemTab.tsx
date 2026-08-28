import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCw, Power, PowerOff, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";

export function SystemTab() {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: maintMode, isLoading: maintLoading } = useQuery({
    queryKey: ["admin", "settings", "system.maintenance_mode"],
    queryFn: () =>
      api.get("/admin/settings/system.maintenance_mode").then((r) => r.data?.data?.["system.maintenance_mode"] === true || r.data?.data?.["system.maintenance_mode"] === "true"),
  });

  const toggleMaint = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put("/admin/settings", { settings: { "system.maintenance_mode": enabled } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings", "system.maintenance_mode"] });
      setShowConfirm(false);
    },
  });

  if (maintLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface-base p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    );
  }

  const isEnabled = maintMode === true;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-surface-base shadow-sm overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Maintenance Mode</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                When enabled, only admins can access the platform. All other users will see a maintenance page.
              </p>
            </div>
            <div className="shrink-0">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                isEnabled
                  ? "bg-status-rejected/10 text-status-rejected border-status-rejected/20"
                  : "bg-status-active/10 text-status-active border-status-active/20",
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", isEnabled ? "bg-status-rejected" : "bg-status-active")} />
                {isEnabled ? "Under Maintenance" : "Live"}
              </span>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="flex items-center gap-4 pt-4 border-t border-border/40">
            <Button
              variant={isEnabled ? "outline" : "destructive"}
              disabled={toggleMaint.isPending}
              onClick={() => setShowConfirm(true)}
              className="gap-2 shadow-sm"
            >
              {toggleMaint.isPending ? (
                <RotateCw className="h-4 w-4 animate-spin" />
              ) : isEnabled ? (
                <Power className="h-4 w-4" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
              {isEnabled ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
            </Button>
            {toggleMaint.isPending && (
              <span className="text-xs text-text-secondary animate-pulse">Updating...</span>
            )}
            {toggleMaint.isSuccess && !toggleMaint.isPending && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Updated
              </span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-text-primary/5">
                {isEnabled ? (
                  <Power className="h-5 w-5 text-text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-text-primary" />
                )}
              </div>
              <div>
                <DialogTitle>
                  {isEnabled ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
                </DialogTitle>
                <DialogDescription className="mt-1.5">
                  {isEnabled
                    ? "The platform will become publicly accessible again. All users will be able to log in and use the service."
                    : "The platform will be taken offline for all non-admin users. Active bookings and transactions will not be affected, but new user access will be blocked."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="shadow-sm">
              Cancel
            </Button>
            <Button
              variant={isEnabled ? "default" : "destructive"}
              onClick={() => toggleMaint.mutate(!isEnabled)}
              disabled={toggleMaint.isPending}
              className="gap-2 shadow-sm"
            >
              {toggleMaint.isPending ? (
                <RotateCw className="h-4 w-4 animate-spin" />
              ) : null}
              {isEnabled ? "Yes, Bring Online" : "Yes, Enable Maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
