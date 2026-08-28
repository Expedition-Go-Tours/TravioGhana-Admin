import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Gavel, ShieldAlert, UserRound, Store, CircleSlash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SectionError } from "@/components/shared/SectionError";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Dispute } from "@/types/payout";

const STATUS_TABS = [
  { key: "OPEN", label: "Open" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESOLVED_CUSTOMER", label: "Refunded" },
  { key: "RESOLVED_SUPPLIER", label: "Denied" },
  { key: "WITHDRAWN", label: "Withdrawn" },
] as const;

type Outcome = "CUSTOMER" | "SUPPLIER" | "WITHDRAWN";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED_CUSTOMER: "Refunded",
  RESOLVED_SUPPLIER: "Denied",
  WITHDRAWN: "Withdrawn",
};

const OUTCOMES: Array<{ value: Outcome; label: string; icon: React.ReactNode; hint: string }> = [
  { value: "CUSTOMER", label: "Approve refund", icon: <UserRound className="h-4 w-4" />, hint: "Refunds the customer via Stripe and cancels the booking's funds. The booking is cancelled too if the tour hasn't run yet" },
  { value: "SUPPLIER", label: "Deny refund", icon: <Store className="h-4 w-4" />, hint: "Request rejected. Funds unfreeze back to the supplier's eligible balance" },
  { value: "WITHDRAWN", label: "Mark withdrawn", icon: <CircleSlash className="h-4 w-4" />, hint: "The supplier pulled their request. Same effect as denying: funds unfrozen" },
];

export function DisputesQueueTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  useSocketInvalidate("admin:dispute-update", ["admin", "disputes"]);

  const [statusTab, setStatusTab] = useState<string>("OPEN");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("SUPPLIER");
  const [resolution, setResolution] = useState("");
  const [refundOverride, setRefundOverride] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "disputes", statusTab],
    queryFn: () => api.get(`/admin/finance/disputes?status=${statusTab}&limit=50`).then((r) => r.data),
  });

  const disputes = (data?.data?.disputes || []) as Dispute[];
  const canResolve = can("disputes.resolve");

  const resolveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { outcome: Outcome; resolution: string; refundAmount?: number } }) =>
      api.patch(`/admin/finance/disputes/${id}/resolve`, body),
    onSuccess: () => {
      toast.success("Refund request resolved");
      queryClient.invalidateQueries({ queryKey: ["admin", "disputes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
      setResolving(null);
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to resolve refund request"),
  });

  const openResolve = (d: Dispute) => {
    setOutcome("SUPPLIER");
    setResolution("");
    setRefundOverride("");
    setResolving(d);
  };

  const handleResolve = () => {
    if (!resolving) return;
    if (!resolution.trim()) { toast.error("A resolution note is required"); return; }
    const bookingAmount = Number(resolving.booking?.grossAmount || 0);
    if (outcome === "CUSTOMER" && refundOverride.trim()) {
      const amount = Number(refundOverride);
      if (Number.isNaN(amount) || amount <= 0) { toast.error("Refund amount must be a positive number"); return; }
      if (amount > bookingAmount) { toast.error(`Refund amount cannot exceed the booking total (${formatCurrency(bookingAmount, resolving.booking?.currency)})`); return; }
    }
    const refundAmount = outcome === "CUSTOMER" && refundOverride.trim() ? Number(refundOverride) : undefined;
    resolveMutation.mutate({
      id: resolving.id,
      body: {
        outcome,
        resolution: resolution.trim(),
        ...(outcome === "CUSTOMER" && refundAmount != null && !Number.isNaN(refundAmount) ? { refundAmount } : {}),
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusTab(key)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none",
              statusTab === key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface-base text-text-secondary hover:text-text-primary"
            )}
          >
            {label}
          </button>
        ))}
        {!isLoading && !isError && disputes.length > 0 && (
          <span className="ml-auto text-xs text-text-tertiary tabular-nums">{disputes.length} request(s)</span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : isError ? (
            <SectionError message="Failed to load refund requests" onRetry={() => refetch()} />
          ) : disputes.length === 0 ? (
            <SectionEmpty message={`No ${STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase()} refund requests`} />
          ) : (
            <div className="divide-y divide-border/60">
              {disputes.map((d) => {
                const expanded = expandedId === d.id;
                const open = d.status === "OPEN" || d.status === "UNDER_REVIEW";
                return (
                  <div key={d.id}>
                    <div
                      className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted/40"
                      onClick={() => setExpandedId(expanded ? null : d.id)}
                    >
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-tertiary transition-transform", expanded && "rotate-180")} />
                      <ShieldAlert className={cn("h-5 w-5 shrink-0", open ? "text-status-pending" : "text-text-tertiary")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{d.disputeNumber}</span>
                          <StatusBadge status={d.status} label={STATUS_LABELS[d.status]} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-text-secondary">
                          {d.booking?.tour?.title || "Unknown tour"}
                          <span className="font-mono text-xs text-text-tertiary"> · {d.booking?.bookingNumber || d.bookingId}</span>
                        </p>
                      </div>
                      <div className="hidden min-w-0 max-w-[220px] flex-1 md:block">
                        <p className="truncate text-xs text-text-tertiary">
                          <span className="font-medium text-text-secondary">{d.reason.replace(/_/g, " ").toLowerCase()}</span>
                          {d.description ? ` · ${d.description}` : ""}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-text-primary tabular-nums">
                          {formatCurrency(Number(d.booking?.grossAmount || 0), d.booking?.currency)}
                        </p>
                        <p className="text-xs text-text-tertiary">at stake</p>
                      </div>
                      <div className="hidden w-24 text-right lg:block">
                        <p className="text-xs text-text-tertiary">{formatDate(d.createdAt)}</p>
                      </div>
                      {open && canResolve && (
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="gap-1" disabled={resolveMutation.isPending} onClick={() => openResolve(d)}>
                            <Gavel className="h-3.5 w-3.5" /> Resolve
                          </Button>
                        </div>
                      )}
                    </div>

                    {expanded && (
                      <div className="border-t border-border/60 bg-surface-muted/30 px-5 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Filed by</p>
                            <p className="mt-1 truncate text-sm text-text-secondary">{d.opener?.name || d.opener?.email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Supplier</p>
                            <p className="mt-1 truncate text-sm text-text-secondary">{d.supplier?.name || d.supplier?.email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Travel date</p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {d.booking?.travelDate ? formatDate(d.booking.travelDate) : "—"}
                            </p>
                          </div>
                        </div>
                        {d.description && (
                          <div className="mt-3 rounded-md border border-border/60 bg-surface-base px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Supplier's explanation</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{d.description}</p>
                          </div>
                        )}
                        {!open && (
                          <div className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                            Resolution: {d.resolution || "—"}
                            {d.refundAmount != null && ` · refunded ${formatCurrency(Number(d.refundAmount), d.booking?.currency)}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve modal */}
      {resolving && (
        <ConfirmModal
          open
          title={`Resolve ${resolving.disputeNumber}`}
          description={`${formatCurrency(Number(resolving.booking?.grossAmount || 0), resolving.booking?.currency)} is frozen on this booking. Choose an outcome.`}
          confirmLabel="Record decision"
          icon="warning"
          loading={resolveMutation.isPending}
          confirmDisabled={resolveMutation.isPending}
          onConfirm={handleResolve}
          onCancel={() => setResolving(null)}
        >
          <div className="space-y-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  outcome === o.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border hover:bg-surface-muted/40"
                )}
              >
                <span className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  outcome === o.value ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-tertiary"
                )}>
                  {o.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{o.label}</span>
                  <span className="block text-xs text-text-tertiary">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="resolution-note">Resolution note (required)</Label>
            <Textarea
              id="resolution-note"
              placeholder="Explain the decision for the audit trail"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
            />
          </div>
          {outcome === "CUSTOMER" && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="refund-override">
                Refund amount. Defaults to full ({formatCurrency(Number(resolving.booking?.grossAmount || 0), resolving.booking?.currency)})
              </Label>
              <Input
                id="refund-override"
                type="number"
                min="0"
                max={Number(resolving.booking?.grossAmount || 0)}
                step="0.01"
                placeholder="Leave empty for full refund"
                value={refundOverride}
                onChange={(e) => setRefundOverride(e.target.value)}
              />
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
