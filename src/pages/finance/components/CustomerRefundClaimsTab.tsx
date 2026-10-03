import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ShieldAlert, Store, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { usePermission } from "@/hooks/usePermission";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type ClaimStatus =
  | "SUBMITTED"
  | "SUPPLIER_APPROVED"
  | "PROCESSING"
  | "SUPPLIER_DECLINED"
  | "RELEASED"
  | "ADMIN_DECLINED"
  | "WITHDRAWN";

interface ClaimBooking {
  bookingNumber?: string;
  grossAmount?: number | string;
  currency?: string;
  refundedAt?: string | null;
  paymentStatus?: string | null;
  customer?: { id?: string; name?: string; email?: string } | null;
  tour?: { title?: string; supplierId?: string; supplier?: { name?: string; email?: string } | null } | null;
}

interface RefundClaim {
  id: string;
  claimNumber: string;
  reason: string;
  details?: string | null;
  type: "FULL" | "PARTIAL";
  requestedAmount?: number | string | null;
  status: ClaimStatus;
  reviewNote?: string | null;
  releasedAmount?: number | string | null;
  createdAt: string;
  booking?: ClaimBooking | null;
}

const STATUS_TABS: Array<{ key: ClaimStatus | "ALL"; label: string }> = [
  { key: "SUPPLIER_APPROVED", label: "Ready to release" },
  { key: "PROCESSING", label: "Releasing" },
  { key: "SUBMITTED", label: "Awaiting supplier" },
  { key: "RELEASED", label: "Released" },
  { key: "SUPPLIER_DECLINED", label: "Declined by supplier" },
  { key: "ADMIN_DECLINED", label: "Declined by admin" },
  { key: "ALL", label: "All" },
];

const REASON_LABELS: Record<string, string> = {
  NOT_AS_DESCRIBED: "Didn't match the description",
  SERVICE_NOT_PROVIDED: "Service wasn't provided",
  GUIDE_ISSUE: "Guide or host issue",
  TRANSPORT_ISSUE: "Transport problem",
  SCHEDULE_CHANGE: "Last-minute schedule change",
  HEALTH_SAFETY: "Health or safety concern",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Awaiting supplier",
  SUPPLIER_APPROVED: "Ready to release",
  PROCESSING: "Releasing",
  SUPPLIER_DECLINED: "Declined by supplier",
  RELEASED: "Released",
  ADMIN_DECLINED: "Declined by admin",
  WITHDRAWN: "Withdrawn",
};

type Action = "release" | "decline";

/**
 * Expanded detail row. Rendered by DataTable into a <tr><td colspan> so it is
 * announced as part of the claim it describes, not as loose content beneath
 * the list.
 */
function ClaimDetail({ claim }: { claim: RefundClaim }) {
  const booking = claim.booking || {};
  const paidTotal = Number(booking.grossAmount || 0);
  return (
    // DataTable's <td> already paints `bg-surface-muted/30` and is `p-0`, so
    // this supplies only the padding; stacking a second 30% tint would render
    // a visibly different shade from the requests table above it.
    <div className="px-5 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Customer</p>
          <p className="mt-1 truncate text-sm text-text-secondary">
            {booking.customer?.name || "—"}
            {booking.customer?.email ? <span className="text-xs text-text-tertiary"> · {booking.customer.email}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Supplier</p>
          <p className="mt-1 truncate text-sm text-text-secondary">{booking.tour?.supplier?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Requested</p>
          <p className="mt-1 text-sm text-text-secondary">
            {claim.type === "FULL"
              ? `Full · ${formatCurrency(paidTotal, booking.currency)}`
              : `Partial · ${formatCurrency(Number(claim.requestedAmount || 0), booking.currency)}`}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-border/60 bg-surface-base px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{REASON_LABELS[claim.reason] || claim.reason}</p>
        {claim.details && <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{claim.details}</p>}
      </div>
      {claim.status === "RELEASED" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Released {formatCurrency(Number(claim.releasedAmount || 0), booking.currency)} on {claim.createdAt ? formatDate(claim.createdAt) : ""}
        </div>
      )}
      {claim.reviewNote && (
        <div className="mt-3 rounded-md bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          Decision note: {claim.reviewNote}
        </div>
      )}
    </div>
  );
}

export function CustomerRefundClaimsTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const focusClaimId = searchParams.get("claimId");

  // Default to "Ready to release", except when arriving from a bell link: the
  // notification points at one specific claim, so resolve against the whole
  // list rather than filtering it out from under the link. Seeding this in the
  // lazy initializer instead of correcting it inside an effect keeps the first
  // render consistent with the data the effect will look for -- and avoids a
  // synchronous setState in an effect, which is both a lint error and a second
  // wasted render on the way in.
  const [statusTab, setStatusTab] = useState<ClaimStatus | "ALL">(focusClaimId ? "ALL" : "SUPPLIER_APPROVED");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ claim: RefundClaim; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [releaseAmount, setReleaseAmount] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "refund-claims", statusTab],
    queryFn: () =>
      api
        .get(`/refund-claims/admin`, {
          params: statusTab !== "ALL" ? { status: statusTab } : {},
          skipGlobalErrorHandler: true,
        })
        .then((r) => r.data),
  });

  const claims = (data?.data?.claims || []) as RefundClaim[];
  const canRelease = can("disputes.resolve");

  // Deep link from the admin bell (?claimId=) — reveal + scroll to the claim.
  // Targets DataTable's `data-row-id`, not an id on a wrapper the table no
  // longer renders. The tab is already seeded to "All" when this is a bell
  // arrival, so if the claim is not here the admin has deliberately filtered
  // it away -- stand down rather than yanking the filter back.
  useEffect(() => {
    if (!focusClaimId || isLoading) return;
    const list = (data?.data?.claims || []) as RefundClaim[];
    if (!list.some((c) => c.id === focusClaimId)) return;
    const timer = setTimeout(() => {
      setFocusedId(focusClaimId);
      document
        .querySelector(`[data-row-id="${focusClaimId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clear = setTimeout(() => setFocusedId(null), 7000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [focusClaimId, isLoading, data]);

  const releaseMutation = useMutation({
    mutationFn: ({ id, releasedAmount }: { id: string; releasedAmount?: number }) =>
      api.patch(`/refund-claims/admin/${id}/release`, releasedAmount != null ? { releasedAmount } : {}),
    onSuccess: () => {
      toast.success("Refund released");
      queryClient.invalidateQueries({ queryKey: ["admin", "refund-claims"] });
      setActionTarget(null);
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to release refund"),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, note: n }: { id: string; note: string }) =>
      api.patch(`/refund-claims/admin/${id}/decline`, { note: n }),
    onSuccess: () => {
      toast.success("Refund request declined");
      queryClient.invalidateQueries({ queryKey: ["admin", "refund-claims"] });
      setActionTarget(null);
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to decline refund request"),
  });

  const openRelease = (claim: RefundClaim) => {
    setNote("");
    setReleaseAmount("");
    setActionTarget({ claim, action: "release" });
  };

  const openDecline = (claim: RefundClaim) => {
    setNote("");
    setReleaseAmount("");
    setActionTarget({ claim, action: "decline" });
  };

  const confirmAction = () => {
    if (!actionTarget) return;
    const { claim, action } = actionTarget;
    const currency = claim.booking?.currency || "USD";
    const paidTotal = Number(claim.booking?.grossAmount || 0);

    if (action === "release") {
      const hasOverride = releaseAmount.trim() !== "";
      const amount = hasOverride ? Number(releaseAmount) : paidTotal;
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error("Release amount must be a positive number");
        return;
      }
      if (amount > paidTotal) {
        toast.error(`Release amount cannot exceed the booking total (${formatCurrency(paidTotal, currency)})`);
        return;
      }
      releaseMutation.mutate({ id: claim.id, releasedAmount: hasOverride ? amount : undefined });
      return;
    }

    if (!note.trim()) {
      toast.error("A decision note is required");
      return;
    }
    declineMutation.mutate({ id: claim.id, note: note.trim() });
  };

  const columns: Column<RefundClaim>[] = [
    {
      key: "claim",
      header: "Request",
      rowHeader: true,
      render: (claim) => {
        const ready = claim.status === "SUPPLIER_APPROVED";
        const releasing = claim.status === "PROCESSING";
        const expanded = expandedId === claim.id;
        const booking = claim.booking || {};
        return (
          <div className="flex items-start gap-2.5">
            <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
              <ChevronDown
                className={cn("h-4 w-4 text-text-tertiary transition-transform", expanded && "rotate-180")}
                aria-hidden="true"
              />
              <ShieldAlert className={cn("h-5 w-5", ready || releasing ? "text-status-pending-text" : "text-text-tertiary")} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{claim.claimNumber}</span>
                <StatusBadge status={claim.status} label={STATUS_LABELS[claim.status] || claim.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {booking.tour?.title || "Unknown tour"}
                <span className="font-mono text-xs text-text-tertiary"> · {booking.bookingNumber || ""}</span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      hideBelow: "md",
      render: (claim) => {
        const booking = claim.booking || {};
        return (
          <p className="max-w-[220px] truncate text-xs text-text-tertiary">
            {booking.customer?.name || "Customer"} · {claim.type === "FULL" ? "Full refund" : "Partial refund"}
          </p>
        );
      },
    },
    {
      key: "amount",
      header: "Paid",
      numeric: true,
      hideBelow: "sm",
      render: (claim) => {
        const booking = claim.booking || {};
        const paidTotal = Number(booking.grossAmount || 0);
        return (
          <span className="block">
            <span className="block text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(paidTotal, booking.currency)}</span>
            <span className="block text-xs text-text-tertiary">paid</span>
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (claim) => {
        const ready = claim.status === "SUPPLIER_APPROVED";
        const releasing = claim.status === "PROCESSING";
        const canDecline = claim.status === "SUBMITTED" || ready;
        const hasActions = (ready || releasing || canDecline) && canRelease;
        if (!hasActions) return null;
        return (
          <span className="inline-flex items-center gap-2">
            {(ready || releasing) && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openRelease(claim)}>
                <RotateCcw className="h-3.5 w-3.5" />
                {releasing ? "Retry release" : "Release"}
              </Button>
            )}
            {canDecline && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openDecline(claim)}>
                <XCircle className="h-3.5 w-3.5" /> Decline
              </Button>
            )}
          </span>
        );
      },
    },
  ];

  const emptyMessage = "No refund requests here";

  return (
    <div className="space-y-4">
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
        {!isLoading && !isError && claims.length > 0 && (
          <span className="ml-auto text-xs text-text-tertiary tabular-nums">{claims.length} request(s)</span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={claims}
        loading={isLoading}
        error={isError ? "Failed to load refund requests" : null}
        onRetry={() => refetch()}
        keyExtractor={(claim) => claim.id}
        caption={`Refund claims — ${STATUS_TABS.find((t) => t.key === statusTab)?.label ?? statusTab}`}
        size="compact"
        expandedRow={expandedId}
        onRowClick={(claim) => setExpandedId(expandedId === claim.id ? null : claim.id)}
        renderExpanded={(claim) => <ClaimDetail claim={claim} />}
        highlightedKey={focusedId ?? undefined}
        emptyMessage={emptyMessage}
      />

      {actionTarget && (
        <ConfirmModal
          open
          title={actionTarget.action === "release" ? `Release ${actionTarget.claim.claimNumber}` : `Decline ${actionTarget.claim.claimNumber}`}
          description={
            actionTarget.action === "release"
              ? "Releasing executes the refund to the customer's original payment method via Stripe."
              : "Declining notifies the customer. Add a note they will see."
          }
          confirmLabel={actionTarget.action === "release" ? "Release refund" : "Decline request"}
          icon="warning"
          loading={releaseMutation.isPending || declineMutation.isPending}
          confirmDisabled={releaseMutation.isPending || declineMutation.isPending}
          onConfirm={confirmAction}
          onCancel={() => setActionTarget(null)}
        >
          <div className="space-y-3">
            {actionTarget.action === "release" ? (
              <div>
                <Label htmlFor="release-amount">Release amount</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="release-amount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={releaseAmount}
                    onChange={(e) => setReleaseAmount(e.target.value)}
                    placeholder={`Full amount · ${formatCurrency(Number(actionTarget.claim.booking?.grossAmount || 0), actionTarget.claim.booking?.currency || "USD")}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
                    {actionTarget.claim.booking?.currency || "USD"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-text-tertiary">Leave empty to refund the full booking amount.</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="claim-decline-note">Decision note</Label>
                <Textarea
                  id="claim-decline-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why is this refund not being released? The customer will see this."
                  className="mt-1.5"
                />
              </div>
            )}
          </div>
        </ConfirmModal>
      )}

      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Store className="h-3.5 w-3.5" />
        Supplier approved requests reach this queue for release. Money only moves here.
      </p>
    </div>
  );
}
