import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Globe,
  Power,
  RotateCw,
  Server,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { QueryErrorState, SettingsCard } from "./shared";

const MAINTENANCE_KEY = "system.maintenance_mode";

function SystemSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, card) => (
        <div key={card} className="overflow-hidden rounded-xl border border-border bg-surface-base">
          <div className="flex items-center gap-3 px-6 py-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <div className="space-y-4 border-t border-border px-6 py-5">
            {Array.from({ length: card === 0 ? 2 : 3 }).map((_, row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span
        className={cn(
          "max-w-[60%] truncate text-right text-[13px] font-medium text-text-primary",
          mono && "font-mono text-xs",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export function SystemTab() {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings").then((r) => r.data?.data || {}),
  });

  const toggleMaintenance = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put("/admin/settings", { settings: { [MAINTENANCE_KEY]: enabled } }),
    onSuccess: (response, enabled) => {
      const saved = response.data?.data;
      if (saved) {
        queryClient.setQueryData(["admin", "settings"], saved);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      setShowConfirm(false);
      toast.success(enabled ? "Maintenance mode enabled" : "Platform is online");
    },
    onError: () => toast.error("Could not update maintenance mode. Please try again."),
  });

  if (isLoading) return <SystemSkeleton />;

  if (isError) {
    return (
      <QueryErrorState
        title="System status unavailable"
        message="We could not read the platform configuration. Check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  const settings = (data || {}) as Record<string, unknown>;
  const isEnabled = String(settings[MAINTENANCE_KEY] ?? "false") === "true";
  const platformName = String(settings["platform.name"] || "Travio Ghana");
  const currency = String(settings["platform.currency"] || "GHS");
  const timezone = String(settings["platform.timezone"] || "Africa/Accra");
  const supportEmail = String(settings["platform.support_email"] || "Not set");
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const consoleHost = typeof window !== "undefined" ? window.location.host : "—";
  const buildMode = import.meta.env.MODE;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Maintenance mode"
        description="Take the public marketplace offline while keeping the admin console available."
        icon={<Power className="h-4 w-4" />}
      >
        {isEnabled && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-status-pending/30 bg-status-pending/10 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-text" />
            <div>
              <p className="text-[13px] font-medium text-status-pending-text">The platform is offline</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-status-pending-text/90">
                Travelers and suppliers see the maintenance page. Admins can still sign in here.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">Public access</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isEnabled
                    ? "bg-status-rejected/10 text-status-rejected-text"
                    : "bg-primary/10 text-primary",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isEnabled ? "bg-status-rejected" : "bg-primary",
                  )}
                />
                {isEnabled ? "Offline" : "Live"}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-text-tertiary">
              When maintenance mode is on, only admins can reach the platform. Existing bookings,
              messages, and payments are not changed.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-medium text-text-tertiary">{isEnabled ? "On" : "Off"}</span>
            <Switch
              checked={isEnabled}
              onCheckedChange={() => setShowConfirm(true)}
              disabled={toggleMaintenance.isPending}
              aria-label="Maintenance mode"
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Platform snapshot"
        description="What travelers and suppliers see. These values are managed in General."
        icon={<Globe className="h-4 w-4" />}
      >
        <div className="divide-y divide-border">
          <InfoRow label="Platform name" value={platformName} />
          <InfoRow label="Settlement currency" value={currency} />
          <InfoRow label="Timezone" value={timezone} />
          <InfoRow label="Support email" value={supportEmail} />
        </div>
        <Link
          to="/admin/settings?tab=general"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          Edit platform settings
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </SettingsCard>

      <SettingsCard
        title="Environment"
        description="Read-only connection details for this admin session."
        icon={<Server className="h-4 w-4" />}
      >
        <div className="divide-y divide-border">
          <InfoRow label="Console host" value={consoleHost} mono />
          <InfoRow label="API endpoint" value={apiBase} mono />
          <InfoRow label="Build mode" value={buildMode} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
          <Link
            to="/admin/activity-log"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
          >
            View admin activity
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary">
            <Clock className="h-3.5 w-3.5" />
            Schedule and payout changes are logged automatically
          </span>
        </div>
      </SettingsCard>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isEnabled ? "bg-primary/10" : "bg-status-rejected/10",
                )}
              >
                {isEnabled ? (
                  <Power className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-status-rejected-text" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle>
                  {isEnabled ? "Bring the platform online?" : "Enable maintenance mode?"}
                </DialogTitle>
                <DialogDescription className="mt-1.5">
                  {isEnabled
                    ? "Travelers and suppliers will be able to sign in and book again immediately."
                    : "The public marketplace will go offline for everyone except admins."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
              What changes
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-text-secondary">
              {(isEnabled
                ? [
                    "The public site and supplier portal reopen.",
                    "Sign-in, search, and checkout resume.",
                    "Admins keep full access throughout.",
                  ]
                : [
                    "Travelers and suppliers see the maintenance page.",
                    "Admins can still use this console.",
                    "Existing bookings and payments are untouched.",
                  ]
              ).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={toggleMaintenance.isPending}>
              Cancel
            </Button>
            <Button
              variant={isEnabled ? "default" : "destructive"}
              onClick={() => toggleMaintenance.mutate(!isEnabled)}
              disabled={toggleMaintenance.isPending}
              className="gap-2"
            >
              {toggleMaintenance.isPending && <RotateCw className="h-4 w-4 animate-spin" />}
              {isEnabled ? "Bring online" : "Enable maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
