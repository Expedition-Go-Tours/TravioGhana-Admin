import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Landmark, Wallet, Smartphone, Send, CheckCircle, XCircle, Search, X,
  AlertTriangle, ShieldCheck, RefreshCw, Ban, Clock, Loader2, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { usePermission } from "@/hooks/usePermission";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate, formatDateTime, getStatusColor } from "@/lib/utils";
import type { PayoutRequest } from "@/types/payout";

/**
 * Payout requests — the approval queue.
 *
 * Two things this screen deliberately gets right that the old list did not:
 *
 * 1. Money is tabular and aligned. Every numeric column uses `tabular-nums` and
 *    is right-aligned so digits line up down the column. Carbon: "toolbar,
 *    batch action bar and pagination heights must all match the row height".
 * 2. The net amount is scannable; the derivation is one click away. Airwallex
 *    models a travel-marketplace payout as gross − commission − fees = net, and
 *    the per-item data (`grossAmount`, `platformCommission`, `supplierPayout`)
 *    has always been on the payload but was never rendered. The expanded row is
 *    that receipt.
 */

const STATUS_TABS = [
  // `PROCESSING` is the backend's name for "created, nobody has approved it
  // yet". Labelling it "Processing" would collide with money actually moving, so
  // the queue uses the operator's word instead. See STATUS_META below.
  { key: "PROCESSING", label: "Needs approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "COMPLETED", label: "Sent" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

/**
 * Carbon's status-indicator rule: 3 of 4 elements (symbol, shape, colour, type)
 * are needed, so every status carries an icon + a word + colour. The word is
 * also what disambiguates states — "awaiting approval" and "money moving" are
 * different states with different owners and must not both read "pending".
 */
const STATUS_META: Record<string, { label: string; Icon: typeof Clock }> = {
  PROCESSING: { label: "Needs approval", Icon: Clock },
  APPROVED: { label: "Approved", Icon: ShieldCheck },
  COMPLETED: { label: "Sent", Icon: CheckCircle },
  REJECTED: { label: "Rejected", Icon: XCircle },
  CANCELLED: { label: "Cancelled", Icon: Ban },
};

type ActionKind = "approve" | "reject" | "complete";

function methodDetail(m: PayoutRequest["payoutMethod"]): string | null {
  if (!m) return null;
  if (m.type === "PAYPAL") return m.paypalEmail || null;
  if (m.type === "BANK_TRANSFER") return m.bankName || m.accountNumber?.slice(-4) || null;
  if (m.type === "MOBILE_MONEY") {
    return [m.mobileProvider, m.mobileNumber].filter(Boolean).join(" ") || null;
  }
  return m.accountName || null;
}

function MethodLabel({ request }: { request: PayoutRequest }) {
  const m = request.payoutMethod;
  if (!m || !m.type) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-status-rejected/10 px-2 py-1 text-xs font-medium text-status-rejected-text">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        No payout method on file. Confirm with the supplier before paying
      </span>
    );
  }
  const Icon = m.type === "PAYPAL" ? Wallet : m.type === "MOBILE_MONEY" ? Smartphone : Landmark;
  const detail = methodDetail(m);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
      {m.type.replace(/_/g, " ")}
      {detail ? <span className="text-text-tertiary">· {detail}</span> : null}
    </span>
  );
}

/** Icon + word + colour, so status is never carried by hue alone. */
function PayoutStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  if (!meta) return <StatusPill status={status} />;
  const { Icon, label } = meta;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        getStatusColor(status),
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", getStatusColor(status))}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/** Copy-to-clipboard for the request number, which is the operator's handle for the payout. */
function RequestNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="whitespace-nowrap font-mono text-xs font-semibold text-text-primary">{value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => toast.error("Could not copy"),
          );
        }}
        className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Copy request number ${value}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-status-active-text" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </span>
  );
}

const REFERENCE_PLACEHOLDERS = ["n/a", "na", "none", "null", "test", "tbd", "xxx", "-", "pending"];

// Mirrors backend normalizeReference: block placeholders and nonsense lengths
// without enforcing a single format (bank references vary by institution).
function validateReference(v: string): string | null {
  const value = v.trim().replace(/\s+/g, " ");
  if (!value) return "A transaction reference is required";
  if (REFERENCE_PLACEHOLDERS.includes(value.toLowerCase())) return "Looks like a placeholder. Enter the actual bank/PayPal reference";
  if (value.length < 4) return "Too short. A real reference has at least 4 characters";
  if (value.length > 100) return "Too long. Max 100 characters";
  return null;
}

const num = (v: number | string | null | undefined) => Number(v || 0);

/**
 * Bookings in a request.
 *
 * The endpoint declared `bookingCount` on the client type but never emitted it,
 * so the Bookings column rendered blank and the receipt read "Gross booking
 * value · undefined bookings". The backend now sends it, but `items` is always
 * included and is the thing the receipt is actually derived from — so it is the
 * more honest source here. Reading the length first means the column stays
 * correct against an older deploy instead of silently going blank.
 */
const bookingCountOf = (r: PayoutRequest) =>
  Array.isArray(r.items) ? r.items.length : num(r.bookingCount);

/**
 * The receipt. Gross − commission should equal the supplier payout; anything
 * left over is surfaced as an explicit adjustment rather than quietly absorbed,
 * so a rounding drift or an unexpected fee line is visible instead of hidden
 * inside the total.
 */
function receiptFor(r: PayoutRequest) {
  const items = r.items || [];
  const gross = items.reduce((s, it) => s + num(it.grossAmount), 0);
  const commission = items.reduce((s, it) => s + num(it.platformCommission), 0);
  const net = items.reduce((s, it) => s + num(it.supplierPayout), 0);
  const expectedNet = gross - commission;
  return {
    items,
    gross,
    commission,
    net,
    /** Residuals under a cent are rounding noise, not an adjustment. */
    adjustment: Math.abs(net - expectedNet) < 0.005 ? 0 : net - expectedNet,
    matches: Math.abs(net - num(r.amount)) < 0.01,
    currency: r.currency || "USD",
  };
}

export function PayoutRequestsTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  useSocketInvalidate("admin:payout-request-update", ["admin", "payout-requests"]);

  // Status is a set, not a single value: the backend already accepts a
  // comma-separated list, so the facets are non-exclusive toggles. Airwallex
  // groups by "is this status conclusive" precisely because buckets overlap —
  // a sent payout can still fail, so it belongs under more than one lens.
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(["PROCESSING"]));
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; request: PayoutRequest } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [completeReference, setCompleteReference] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const limit = 20;

  // An empty set, or every status selected, means "don't filter" — sending the
  // full list would work but hides intent in the request.
  const statusParam = useMemo(() => {
    if (statusFilter.size === 0 || statusFilter.size === STATUS_TABS.length) return "";
    return Array.from(statusFilter).join(",");
  }, [statusFilter]);

  const statusLabel = useMemo(() => {
    if (statusFilter.size === 0 || statusFilter.size === STATUS_TABS.length) return "all statuses";
    return STATUS_TABS.filter((t) => statusFilter.has(t.key)).map((t) => t.label).join(" + ").toLowerCase();
  }, [statusFilter]);

  const handleSort = (key: string) => {
    // Clicking the active column flips direction; a new column starts descending,
    // which is what an operator wants for both amount and date.
    if (key === sortBy) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "payout-requests", statusParam, page, debouncedSearch, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder });
      if (statusParam) params.set("status", statusParam);
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api.get(`/admin/finance/payout-requests?${params.toString()}`).then((r) => r.data);
    },
    placeholderData: (prev) => prev,
  });

  // Memoised because `selectedRows`/`selectedTotal` memoise against it; without
  // this the row list is a fresh array every render and those memos never hit.
  const requests = useMemo(
    () => (data?.data?.requests || []) as PayoutRequest[],
    [data],
  );
  const pagination = data?.data?.pagination;
  const summary = data?.data?.summary as { statusCounts?: Record<string, number>; totalCount?: number; totalAmount?: number } | undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/finance/payout-requests/${id}/approve`),
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/finance/payout-requests/${id}/reject`, { reason }),
    onSuccess: () => { toast.success("Payout request rejected; bookings returned to eligible"); invalidate(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to reject"),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, reference, notes }: { id: string; reference: string; notes?: string }) =>
      api.patch(`/admin/finance/payout-requests/${id}/complete`, { reference, notes }),
    onSuccess: (res: { data?: { data?: { warning?: string } } }) => {
      toast.success("Payout marked as sent; ledger updated");
      const warning = res?.data?.data?.warning;
      if (warning) toast.warning(warning);
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to complete payout"),
  });

  // Pessimistic, never optimistic: releasing money waits for the server.
  const busy = approveMutation.isPending || rejectMutation.isPending || completeMutation.isPending;

  const handleConfirm = () => {
    if (!action) return;
    const { kind, request } = action;
    if (kind === "approve") {
      approveMutation.mutate(request.id, { onSettled: () => { invalidate(); setAction(null); } });
    } else if (kind === "reject") {
      if (!rejectReason.trim()) { toast.error("A rejection reason is required"); return; }
      rejectMutation.mutate({ id: request.id, reason: rejectReason.trim() }, { onSettled: () => setAction(null) });
    } else {
      const refErr = validateReference(completeReference);
      if (refErr) { toast.error(refErr); return; }
      completeMutation.mutate(
        { id: request.id, reference: completeReference.trim().replace(/\s+/g, " "), notes: completeNotes.trim() || undefined },
        { onSettled: () => setAction(null) }
      );
    }
  };

  const openAction = (kind: ActionKind, request: PayoutRequest) => {
    setRejectReason("");
    setCompleteReference("");
    setCompleteNotes("");
    setAction({ kind, request });
  };

  const toggleStatus = (key: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      // Deselecting the last chip means "no status filter" — the same state as
      // selecting all of them. Both send no `status` param, so the button must
      // not jump between two visually identical states.
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
    setExpandedId(null);
    setSelected(new Set());
  };

  const refError = validateReference(completeReference);

  // ── Selection ─────────────────────────────────────────────────────────────
  // Only rows in PROCESSING can be batch-approved, so only those are selectable.
  const isSelectable = (r: PayoutRequest) => r.status === "PROCESSING" && can("payouts.approve");

  const selectedRows = useMemo(
    () => requests.filter((r) => selected.has(r.id)),
    [requests, selected],
  );
  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + num(r.amount), 0),
    [selectedRows],
  );
  const selectedCurrency = selectedRows[0]?.currency || "USD";
  // Mixed currency must not be summed into one meaningless number.
  const mixedCurrency = useMemo(
    () => new Set(selectedRows.map((r) => r.currency || "USD")).size > 1,
    [selectedRows],
  );

  const [bulkResults, setBulkResults] = useState<{ ok: string[]; failed: { id: string; why: string }[] } | null>(null);
  const [bulkPendingIds, setBulkPendingIds] = useState<Set<string>>(new Set());

  /**
   * Batch approve. One interaction, but the report is per-row: an aggregate
   * "42 approved" that hides 12 failures is worse than useless in a payout queue,
   * so failures are listed by request number.
   */
  const runBulkApprove = async () => {
    const ids = selectedRows.map((r) => r.id);
    setBulkPendingIds(new Set(ids));
    const ok: string[] = [];
    const failed: { id: string; why: string }[] = [];
    for (const row of selectedRows) {
      try {
        await api.patch(`/admin/finance/payout-requests/${row.id}/approve`);
        ok.push(row.requestNumber);
      } catch (e) {
        failed.push({
          id: row.requestNumber,
          why: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Request failed",
        });
      }
      // Clear this row's spinner as it lands so progress is visible.
      setBulkPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
    setBulkPendingIds(new Set());
    setBulkResults({ ok, failed });
    setSelected(new Set());
    invalidate();
  };

  const modalConfig = action && ({
    approve: {
      title: "Approve payout request",
      description: `Authorize ${formatCurrency(num(action.request.amount), action.request.currency)} to ${action.request.supplier?.name || "supplier"} (${action.request.requestNumber})?`,
      confirmLabel: `Approve ${formatCurrency(num(action.request.amount), action.request.currency)}`,
      icon: "publish" as const,
      body: (
        <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Payment destination</p>
          <div className="mt-1.5"><MethodLabel request={action.request} /></div>
        </div>
      ),
    },
    reject: {
      title: "Reject payout request",
      description: `Rejecting returns all ${bookingCountOf(action.request)} booking${bookingCountOf(action.request) === 1 ? "" : "s"} to the eligible pool so the supplier can re-request.`,
      confirmLabel: "Reject request",
      icon: "danger" as const,
      body: (
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason (required)</Label>
          <Textarea
            id="reject-reason"
            placeholder="e.g. Payout method details need updating"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
        </div>
      ),
    },
    complete: {
      title: "Mark payout as sent",
      description: `Ledger rows are written and all ${bookingCountOf(action.request)} booking${bookingCountOf(action.request) === 1 ? "" : "s"} are marked PAID.`,
      confirmLabel: "Confirm sent",
      icon: "warning" as const,
      body: (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Paid via</p>
            <div className="mt-1.5"><MethodLabel request={action.request} /></div>
          </div>
          {!receiptFor(action.request).matches && (
            <div className="rounded-lg border border-status-rejected/30 bg-status-rejected/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-status-rejected-text">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Items total mismatch — cannot complete
              </p>
              <p className="mt-1 text-xs text-status-rejected-text">
                The sum of item payouts ({formatCurrency(receiptFor(action.request).net, action.request.currency)}) does not
                match the request amount ({formatCurrency(num(action.request.amount), action.request.currency)}). Resolve before
                marking as sent.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              If any booking in this request has an open dispute, the backend will block completion. Resolve disputes first.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="complete-reference">Transaction reference (required)</Label>
            <Input
              id="complete-reference"
              placeholder="e.g. TRX-8841209 or PayPal txn id"
              value={completeReference}
              onChange={(e) => setCompleteReference(e.target.value)}
              aria-invalid={!!refError}
              aria-describedby={refError && completeReference.length > 0 ? "complete-reference-error" : undefined}
            />
            {refError && completeReference.length > 0 && (
              <p id="complete-reference-error" className="text-xs font-medium text-status-rejected-text">{refError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="complete-notes">Notes (optional)</Label>
            <Textarea
              id="complete-notes"
              placeholder="Anything worth recording about this transfer"
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      ),
    },
  })[action.kind];

  // Counts come from `statusCounts`, which the backend computes from the search
  // scope only — never from the status filter itself. That is what makes them
  // stable while you toggle facets, instead of collapsing to whatever is
  // currently selected.
  const activeCount = useMemo(() => {
    if (!statusParam) return summary?.totalCount ?? requests.length;
    let sum = 0;
    for (const key of statusFilter) sum += summary?.statusCounts?.[key] ?? 0;
    return sum;
  }, [statusParam, statusFilter, summary, requests.length]);

  const columns: Column<PayoutRequest>[] = [
    {
      // Column keys are the literal `sortBy` values the backend whitelists, so
      // `onSort(col.key)` is a passthrough. `supplier`, `cycle` and
      // `bookingCount` are intentionally absent from that whitelist, so they
      // are not marked sortable -- an arrow that silently does nothing is worse
      // than no arrow.
      key: "requestNumber",
      header: "Request",
      rowHeader: true,
      sortable: true,
      render: (r) => (
        <div className="flex flex-col gap-1">
          <RequestNumber value={r.requestNumber} />
          <div className="flex flex-wrap items-center gap-1.5">
            {r.autoGenerated && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                <RefreshCw className="h-3 w-3" aria-hidden /> Scheduled run
              </span>
            )}
            {!r.payoutMethod?.type && r.status !== "REJECTED" && r.status !== "CANCELLED" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-status-rejected/10 px-1.5 py-0.5 text-[11px] font-semibold text-status-rejected-text">
                <AlertTriangle className="h-3 w-3" aria-hidden /> No method
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {r.supplier?.name || r.supplier?.email || "Unknown supplier"}
          </p>
          <p className="truncate text-xs text-text-tertiary">{r.supplier?.email}</p>
        </div>
      ),
    },
    {
      key: "cycle",
      header: "Cycle",
      hideBelow: "lg",
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-text-secondary">{r.cycleLabel}</span>
      ),
    },
    {
      key: "bookingCount",
      header: "Bookings",
      numeric: true,
      render: (r) => <span className="text-sm tabular-nums text-text-secondary">{bookingCountOf(r)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      sortable: true,
      render: (r) => (
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          {formatCurrency(num(r.amount), r.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <PayoutStatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      header: "Submitted",
      numeric: true,
      sortable: true,
      hideBelow: "md",
      render: (r) => <span className="text-sm tabular-nums text-text-secondary">{formatDate(r.createdAt)}</span>,
    },
    {
      // Primer: the column holding row actions has no visible header.
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (r) => {
        const canAct = r.status === "PROCESSING" && can("payouts.approve");
        const canComplete = r.status === "APPROVED" && can("payouts.approve");
        if (!canAct && !canComplete) return null;
        return (
          <div className="flex items-center justify-end gap-2">
            {canAct && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  aria-label={`Approve payout request ${r.requestNumber}`}
                  onClick={() => openAction("approve", r)}
                >
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-status-rejected-text hover:text-status-rejected-text"
                  disabled={busy}
                  aria-label={`Reject payout request ${r.requestNumber}`}
                  onClick={() => openAction("reject", r)}
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
                </Button>
              </>
            )}
            {canComplete && (
              <Button
                size="sm"
                className="gap-1"
                disabled={busy}
                aria-label={`Mark payout request ${r.requestNumber} as sent`}
                onClick={() => openAction("complete", r)}
              >
                <Send className="h-3.5 w-3.5" aria-hidden /> Mark sent
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* One live region for the whole queue. Bulk outcomes are announced here
          rather than as a green banner, and never as a single aggregate count. */}
      <div role="status" aria-atomic="true" className="sr-only">
        {bulkResults
          ? `${bulkResults.ok.length} payout request${bulkResults.ok.length === 1 ? "" : "s"} approved.` +
            (bulkResults.failed.length
              ? ` ${bulkResults.failed.length} failed: ${bulkResults.failed.map((f) => `${f.id} (${f.why})`).join("; ")}.`
              : "")
          : ""}
      </div>

      {/* Status facets with counts. Non-exclusive: aria-pressed toggles rather
          than tab semantics, because a payout can legitimately sit under more
          than one lens and the operator usually wants two at once (e.g.
          "Needs approval" + "Approved" when working a backlog down). */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter payout requests by status">
          {STATUS_TABS.map(({ key, label }) => {
            const count = summary?.statusCounts?.[key];
            const active = statusFilter.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface-base text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                )}
              >
                {label}
                {count != null && (
                  // Active: NO pill fill. A `bg-primary-foreground/20` tint puts
                  // the label colour on a lighter version of itself, which
                  // measured 1.00:1 -- invisible. The count inherits the chip's
                  // own 4.5:1/6.2:1 and gets hierarchy from size + weight.
                  // Inactive: a muted pill is fine, it sits on the page surface
                  // rather than on the fill.
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      active ? "rounded-full" : "rounded-full bg-surface-muted text-text-secondary",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button
              type="button"
              onClick={() => { setStatusFilter(new Set()); setPage(1); }}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
          )}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <Input
            placeholder="Search request # or supplier…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9 pr-8"
            aria-label="Search payout requests"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-tertiary hover:text-text-secondary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* True totals across all statuses for the current search. */}
      {!isLoading && !isError && (summary?.totalCount ?? 0) > 0 && (
        <p className={cn("text-xs tabular-nums text-text-tertiary transition-opacity", isFetching && "opacity-50")}>
          {summary?.totalCount} request{summary?.totalCount === 1 ? "" : "s"} across all statuses ·{" "}
          {formatCurrency(summary?.totalAmount ?? 0)} total · showing {activeCount} {statusLabel}
        </p>
      )}

      {/* Per-row outcome report from a batch approve. */}
      {bulkResults && (bulkResults.failed.length > 0 || bulkResults.ok.length > 0) && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            bulkResults.failed.length
              ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
              : "border-status-active/30 bg-status-active/10",
          )}
        >
          <p className={cn("text-sm font-medium", bulkResults.failed.length ? "text-amber-800 dark:text-amber-200" : "text-status-active-text")}>
            {bulkResults.ok.length} approved
            {bulkResults.failed.length > 0 && `, ${bulkResults.failed.length} could not be`}
          </p>
          {bulkResults.failed.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {bulkResults.failed.map((f) => (
                <li key={f.id} className="text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-mono font-semibold">{f.id}</span> — {f.why}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setBulkResults(null)}
            className="mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={requests}
        loading={isLoading}
        error={isError ? "Failed to load payout requests" : null}
        onRetry={() => refetch()}
        keyExtractor={(r) => r.id}
        caption={`Payout requests — ${statusLabel}`}
        size="dense"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        expandedRow={expandedId}
        onRowClick={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
        renderExpanded={(r) => <PayoutDetail request={r} />}
        pagination={pagination ? {
          page: pagination.currentPage || page,
          totalPages: pagination.totalPages || 1,
          totalCount: pagination.totalCount || 0,
          onPageChange: setPage,
        } : undefined}
        emptyMessage={
          debouncedSearch
            ? `No ${statusLabel} requests match “${debouncedSearch}”`
            : statusFilter.size === 1 && statusFilter.has("PROCESSING")
              ? "Nothing needs your approval right now"
              : `No ${statusLabel} requests`
        }
        selection={{ selected, onChange: setSelected, isSelectable }}
        selectionLabel="Select payout request"
        rowPending={(r) => bulkPendingIds.has(r.id)}
        batchBar={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-primary">
              {selectedRows.length} selected
              {!mixedCurrency && selectedRows.length > 0 && (
                <span className="ml-2 font-normal tabular-nums text-text-secondary">
                  {formatCurrency(selectedTotal, selectedCurrency)} total
                </span>
              )}
              {mixedCurrency && <span className="ml-2 font-normal text-status-flagged-text">mixed currencies</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={bulkPendingIds.size > 0}
                onClick={() => {
                  setBulkResults(null);
                  setBulkOpen(true);
                }}
              >
                {bulkPendingIds.size > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle className="h-3.5 w-3.5" aria-hidden />}
                Approve {selectedRows.length}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={bulkPendingIds.size > 0}>
                Clear
              </Button>
            </div>
          </div>
        }
      />

      {bulkOpen && (
        <ConfirmModal
          open
          title={`Approve ${selectedRows.length} payout request${selectedRows.length === 1 ? "" : "s"}?`}
          description={
            mixedCurrency
              ? `Releases ${selectedRows.length} requests across ${new Set(selectedRows.map((r) => r.currency || "USD")).size} currencies. Review each destination before continuing.`
              : `${formatCurrency(selectedTotal, selectedCurrency)} will be released across ${selectedRows.length} request${selectedRows.length === 1 ? "" : "s"}. Each request is approved individually — any that fail are listed with the reason.`
          }
          confirmLabel={mixedCurrency ? `Approve ${selectedRows.length} requests` : `Approve ${formatCurrency(selectedTotal, selectedCurrency)}`}
          icon="publish"
          loading={bulkPendingIds.size > 0}
          onConfirm={() => {
            setBulkOpen(false);
            void runBulkApprove();
          }}
          onCancel={() => setBulkOpen(false)}
        />
      )}

      {action && modalConfig && (
        <ConfirmModal
          open
          title={modalConfig.title}
          description={modalConfig.description}
          confirmLabel={modalConfig.confirmLabel}
          icon={modalConfig.icon}
          loading={busy}
          confirmDisabled={busy || (action.kind === "complete" && (!!refError || !receiptFor(action.request).matches))}
          onConfirm={handleConfirm}
          onCancel={() => setAction(null)}
        >
          {modalConfig.body}
        </ConfirmModal>
      )}
    </div>
  );
}

/**
 * The expanded payout: who did what, when, and how the net was reached.
 *
 * The lifecycle rail uses the step-indicator vocabulary (outlined / filled
 * circles, active vs inactive connector) as a read-only status strip. It is
 * deliberately not clickable — a payout's past is not navigable, and Carbon/USWDS
 * both restrict step indicators to linear, user-driven flows.
 */
function PayoutDetail({ request: r }: { request: PayoutRequest }) {
  const rc = receiptFor(r);
  const terminalError = r.status === "REJECTED" || r.status === "CANCELLED";

  const steps = [
    {
      key: "submitted",
      label: "Submitted",
      at: r.createdAt,
      actor: r.autoGenerated ? "Scheduler" : "Supplier",
      done: true,
      current: false,
    },
    {
      key: "approved",
      label: "Approved",
      at: r.approvedAt,
      actor: r.approvedBy,
      done: !!r.approvedAt,
      current: r.status === "APPROVED",
      error: false,
    },
    {
      key: "sent",
      label: "Sent",
      at: r.completedAt,
      actor: r.completedBy,
      done: !!r.completedAt,
      current: false,
      error: false,
    },
  ];

  return (
    <div className="px-5 py-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: provenance + receipt summary */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Destination</p>
            <div className="mt-1.5"><MethodLabel request={r} /></div>
          </div>

          {/* Itemised receipt — the derivation behind the scanned net. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">How the payout is made up</p>
            <dl className="mt-1.5 space-y-1">
              <ReceiptLine label={`Gross booking value · ${bookingCountOf(r)} booking${bookingCountOf(r) === 1 ? "" : "s"}`} value={formatCurrency(rc.gross, rc.currency)} />
              <ReceiptLine label="Platform commission" value={rc.commission > 0 ? `−${formatCurrency(rc.commission, rc.currency)}` : formatCurrency(0, rc.currency)} muted />
              {rc.adjustment !== 0 && (
                <ReceiptLine label="Adjustment" value={`${rc.adjustment > 0 ? "+" : "−"}${formatCurrency(Math.abs(rc.adjustment), rc.currency)}`} muted />
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
                <dt className="text-sm font-semibold text-text-primary">Supplier payout</dt>
                <dd className="text-sm font-semibold tabular-nums text-text-primary">
                  {formatCurrency(rc.net, rc.currency)}
                </dd>
              </div>
            </dl>
            {!rc.matches && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-status-rejected-text">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Items sum to {formatCurrency(rc.net, rc.currency)} but the request says {formatCurrency(num(r.amount), r.currency)}
              </p>
            )}
          </div>

          {r.rejectedReason && (
            <div className="rounded-md bg-status-rejected/10 px-3 py-2">
              <p className="text-xs font-semibold text-status-rejected-text">Rejection reason</p>
              <p className="mt-0.5 text-sm text-status-rejected-text">{r.rejectedReason}</p>
            </div>
          )}
          {r.notes && !terminalError && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Notes</p>
              <p className="mt-1 text-sm text-text-secondary">{r.notes}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {r.reference ? "Bank reference" : "Transaction reference"}
            </p>
            {r.reference ? (
              <p className="mt-1 font-mono text-sm text-text-primary">{r.reference}</p>
            ) : r.status === "APPROVED" || r.status === "PROCESSING" ? (
              <p className="mt-1 text-sm text-text-tertiary">Recorded when marked as sent</p>
            ) : null}
          </div>
        </div>

        {/* Right: lifecycle rail + per-item table */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Lifecycle</p>
            <ol className="mt-2 flex items-start gap-0">
              {steps.map((s, i) => {
                const isError = terminalError && s.key !== "submitted" && !s.done;
                const isCurrent = s.current;
                return (
                  <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <div className={cn("h-px flex-1", i === 0 ? "bg-transparent" : s.done ? "bg-primary" : "bg-border")} />
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                          s.done && "border-primary bg-primary text-primary-foreground",
                          !s.done && isCurrent && "border-primary bg-surface-base text-primary",
                          !s.done && !isCurrent && !isError && "border-border-muted bg-surface-base text-text-tertiary",
                          isError && "border-status-rejected bg-status-rejected/10 text-status-rejected-text",
                        )}
                      >
                        {s.done ? (
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                        ) : isError ? (
                          <XCircle className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <span className="text-[10px] font-semibold">{i + 1}</span>
                        )}
                      </span>
                      <div className={cn("h-px flex-1", i === steps.length - 1 ? "bg-transparent" : s.done ? "bg-primary" : "bg-border")} />
                    </div>
                    <span className={cn("mt-1.5 text-xs font-medium", s.done || isCurrent ? "text-text-primary" : "text-text-tertiary")}>
                      {s.label}
                    </span>
                    <span className="mt-0.5 text-[11px] tabular-nums text-text-tertiary">
                      {s.at ? formatDate(s.at) : "Pending"}
                    </span>
                    {s.actor && (
                      <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-text-secondary" title={s.actor}>
                        {s.actor}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {r.rejectedAt && (
              <p className="mt-2 text-xs text-status-rejected-text">
                {r.status === "REJECTED" ? "Rejected" : "Cancelled"} {formatDateTime(r.rejectedAt)}
                {r.rejectedBy ? ` by ${r.rejectedBy}` : ""}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border/60">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Bookings included in payout request {r.requestNumber}, with gross value, commission and supplier payout
                </caption>
                <thead>
                  <tr className="sticky top-0 border-b border-border/60 bg-surface-muted/95 text-xs backdrop-blur-md">
                    <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">Booking</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">Travel</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
                      <span className="sr-only">Gross booking value</span>
                      <span aria-hidden>Gross</span>
                    </th>
                    <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary sm:table-cell">
                      <span className="sr-only">Platform commission</span>
                      <span aria-hidden>Commission</span>
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
                      <span className="sr-only">Supplier payout</span>
                      <span aria-hidden>Net</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rc.items.map((it) => (
                    <tr key={it.id}>
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <span className="font-mono text-xs text-text-primary">{it.booking?.bookingNumber || it.bookingId}</span>
                      </th>
                      <td className="px-3 py-2 tabular-nums text-text-secondary">
                        {it.booking?.travelDate ? formatDate(it.booking.travelDate) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                        {formatCurrency(num(it.grossAmount), it.currency || rc.currency)}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-text-tertiary sm:table-cell">
                        {num(it.platformCommission) > 0 ? `−${formatCurrency(num(it.platformCommission), it.currency || rc.currency)}` : null}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-text-primary">
                        {formatCurrency(num(it.supplierPayout), it.currency || rc.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="sticky bottom-0 border-t-2 border-border bg-surface-muted/95 backdrop-blur-md">
                    <th scope="row" colSpan={2} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Total
                    </th>
                    <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-secondary">
                      {formatCurrency(rc.gross, rc.currency)}
                    </td>
                    <td className="hidden px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-secondary sm:table-cell">
                      {rc.commission > 0 ? `−${formatCurrency(rc.commission, rc.currency)}` : formatCurrency(0, rc.currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-primary">
                      {formatCurrency(rc.net, rc.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border/60 bg-surface-base px-3 py-2">
              {rc.matches ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-status-active-text">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Items total matches the request amount
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-rejected-text">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Mismatch — request says {formatCurrency(num(r.amount), rc.currency)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-sm", muted ? "text-text-tertiary" : "text-text-secondary")}>{label}</dt>
      <dd className={cn("text-sm tabular-nums", muted ? "text-text-tertiary" : "text-text-secondary")}>{value}</dd>
    </div>
  );
}