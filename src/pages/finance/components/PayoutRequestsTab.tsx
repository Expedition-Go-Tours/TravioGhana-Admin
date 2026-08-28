import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronLeft, ChevronRight, Landmark, Wallet, Inbox, Send,
  CheckCircle, XCircle, Eye, Search, X, AlertTriangle, ShieldCheck,
} from "lucide-react";
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
import type { PayoutRequest } from "@/types/payout";

const STATUS_TABS = [
  { key: "PROCESSING", label: "Pending Approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

type ActionKind = "approve" | "reject" | "complete";

function methodDetail(m: PayoutRequest["payoutMethod"]): string | null {
  if (!m) return null;
  if (m.type === "PAYPAL") return m.paypalEmail || null;
  if (m.type === "BANK_TRANSFER") return m.bankName || m.accountNumber?.slice(-4) || null;
  return m.accountName || null;
}

function MethodLabel({ request }: { request: PayoutRequest }) {
  const m = request.payoutMethod;
  if (!m || !m.type) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        No payout method on file. Confirm with the supplier before paying
      </span>
    );
  }
  const Icon = m.type === "PAYPAL" ? Wallet : Landmark;
  const detail = methodDetail(m);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
      {m.type.replace(/_/g, " ")}
      {detail ? <span className="text-text-tertiary">· {detail}</span> : null}
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

export function PayoutRequestsTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  useSocketInvalidate("admin:payout-request-update", ["admin", "payout-requests"]);

  const [statusTab, setStatusTab] = useState<string>("PROCESSING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [action, setAction] = useState<{ kind: ActionKind; request: PayoutRequest } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [completeReference, setCompleteReference] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "payout-requests", statusTab, page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ status: statusTab, page: String(page), limit: String(limit) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api.get(`/admin/finance/payout-requests?${params.toString()}`).then((r) => r.data);
    },
    placeholderData: (prev) => prev,
  });

  const requests = (data?.data?.requests || []) as PayoutRequest[];
  const pagination = data?.data?.pagination;
  const summary = data?.data?.summary as { statusCounts?: Record<string, number>; totalCount?: number; totalAmount?: number } | undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/finance/payout-requests/${id}/approve`),
    onSuccess: () => { toast.success("Payout request approved"); invalidate(); },
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

  const busy = approveMutation.isPending || rejectMutation.isPending || completeMutation.isPending;

  // Cross-check: sum of item payouts should equal the request total.
  const itemsCheck = (r: PayoutRequest) => {
    const sum = (r.items || []).reduce((s, it) => s + Number(it.supplierPayout || 0), 0);
    return { sum, matches: Math.abs(sum - Number(r.amount || 0)) < 0.01 };
  };

  const handleConfirm = () => {
    if (!action) return;
    const { kind, request } = action;
    if (kind === "approve") {
      approveMutation.mutate(request.id, { onSettled: () => setAction(null) });
    } else if (kind === "reject") {
      if (!rejectReason.trim()) { toast.error("A rejection reason is required"); return; }
      rejectMutation.mutate({ id: request.id, reason: rejectReason.trim() }, { onSettled: () => setAction(null) });
    } else {
      const refError = validateReference(completeReference);
      if (refError) { toast.error(refError); return; }
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

  const switchTab = (key: string) => {
    setStatusTab(key);
    setPage(1);
    setExpandedId(null);
  };

  const refError = validateReference(completeReference);

  const modalConfig = action && ({
    approve: {
      title: "Approve payout request",
      description: `Authorize ${formatCurrency(Number(action.request.amount), action.request.currency)} to ${action.request.supplier?.name || "supplier"} (${action.request.requestNumber})?`,
      confirmLabel: "Approve",
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
      description: `Rejecting returns all ${action.request.bookingCount} booking(s) to the eligible pool so the supplier can re-request.`,
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
      description: `This is final: ledger rows are written and all ${action.request.bookingCount} booking(s) are marked PAID.`,
      confirmLabel: "Confirm sent",
      icon: "warning" as const,
      body: (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Paid via</p>
            <div className="mt-1.5"><MethodLabel request={action.request} /></div>
          </div>
          {!itemsCheck(action.request).matches && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Items total mismatch — cannot complete
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                The sum of item payouts ({formatCurrency(itemsCheck(action.request).sum, action.request.currency)}) does not match the request amount ({formatCurrency(Number(action.request.amount), action.request.currency)}). This must be resolved before marking as sent.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
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
            />
            {refError && completeReference.length > 0 && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{refError}</p>
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

  const activeCount = summary?.statusCounts?.[statusTab] ?? requests.length;

  return (
    <div className="space-y-4">
      {/* Status tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map(({ key, label }) => {
            const count = summary?.statusCounts?.[key];
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none",
                  statusTab === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface-base text-text-secondary hover:text-text-primary"
                )}
              >
                {label}
                {count != null && count > 0 && (
                  <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    statusTab === key ? "bg-primary-foreground/20" : "bg-surface-muted text-text-tertiary")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search request # or supplier…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* True totals across all statuses for the current search */}
      {!isLoading && !isError && (summary?.totalCount ?? 0) > 0 && (
        <p className={cn("text-xs text-text-tertiary tabular-nums transition-opacity", isFetching && "opacity-50")}>
          {summary?.totalCount} request(s) across all statuses · {formatCurrency(summary?.totalAmount ?? 0)} total · showing {activeCount} {STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase()}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : isError ? (
            <SectionError message="Failed to load payout requests" onRetry={() => refetch()} />
          ) : requests.length === 0 ? (
            <SectionEmpty message={
              debouncedSearch
                ? `No ${STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase()} requests match "${debouncedSearch}"`
                : `No ${STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase()} requests`
            } />
          ) : (
            <div className="divide-y divide-border/60">
              {requests.map((r) => {
                const expanded = expandedId === r.id;
                const canAct = r.status === "PROCESSING" && can("payouts.approve");
                const canComplete = r.status === "APPROVED" && can("payouts.approve");
                const check = itemsCheck(r);
                const noMethod = !r.payoutMethod?.type;
                return (
                  <div key={r.id}>
                    <div
                      className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted/40"
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                    >
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-tertiary transition-transform", expanded && "rotate-180")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{r.requestNumber}</span>
                          <StatusBadge status={r.status} />
                          {noMethod && r.status !== "REJECTED" && r.status !== "CANCELLED" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3" /> No method
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-text-secondary">
                          {r.supplier?.name || r.supplier?.email || "Unknown supplier"}
                          <span className="text-text-tertiary"> · cycle {r.cycleLabel}</span>
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(Number(r.amount), r.currency)}</p>
                        <p className="text-xs text-text-tertiary">{r.bookingCount} booking(s)</p>
                      </div>
                      <div className="hidden w-28 text-right md:block">
                        <p className="text-xs text-text-tertiary">{formatDate(r.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {canAct && (
                          <>
                            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => openAction("approve", r)}>
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 text-red-500 hover:text-red-600" disabled={busy} onClick={() => openAction("reject", r)}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {canComplete && (
                          <Button size="sm" className="gap-1" disabled={busy} onClick={() => openAction("complete", r)}>
                            <Send className="h-3.5 w-3.5" /> Mark sent
                          </Button>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-border/60 bg-surface-muted/30 px-5 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Destination</p>
                            <div className="mt-1"><MethodLabel request={r} /></div>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Timeline</p>
                            <p className="mt-1 text-sm text-text-secondary">
                              Submitted {formatDate(r.createdAt)}
                              {r.approvedAt && ` · approved ${formatDate(r.approvedAt)}`}
                              {r.completedAt && ` · completed ${formatDate(r.completedAt)}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Reference</p>
                            {r.reference ? (
                              <p className="mt-1 font-mono text-sm text-text-secondary">{r.reference}</p>
                            ) : r.status === "APPROVED" || r.status === "PROCESSING" ? (
                              <p className="mt-1 text-sm italic text-text-tertiary">Recorded when marked as sent</p>
                            ) : (
                              <p className="mt-1 text-sm text-text-tertiary">—</p>
                            )}
                          </div>
                        </div>
                        {r.rejectedReason && (
                          <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            Rejection reason: {r.rejectedReason}
                          </p>
                        )}
                        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60 bg-surface-base">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                                <th className="px-4 py-2 font-semibold">Booking</th>
                                <th className="px-4 py-2 font-semibold">Tour</th>
                                <th className="px-4 py-2 font-semibold">Travel date</th>
                                <th className="px-4 py-2 text-right font-semibold">Supplier payout</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {(r.items || []).map((it) => (
                                <tr key={it.id}>
                                  <td className="px-4 py-2 font-mono text-xs text-primary">{it.booking?.bookingNumber || it.bookingId}</td>
                                  <td className="max-w-[220px] truncate px-4 py-2 text-text-secondary">{it.booking?.tour?.title || "—"}</td>
                                  <td className="px-4 py-2 text-text-tertiary">{it.booking?.travelDate ? formatDate(it.booking.travelDate) : "—"}</td>
                                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatCurrency(Number(it.supplierPayout || 0), it.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border/60">
                                <td colSpan={3} className="px-4 py-2 text-right text-[11px] uppercase tracking-wider text-text-tertiary">
                                  Items total · {check.matches ? (
                                    <span className="inline-flex items-center gap-1 normal-case text-emerald-600 dark:text-emerald-400">
                                      <ShieldCheck className="h-3.5 w-3.5" /> matches request
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 normal-case font-semibold text-red-600 dark:text-red-400">
                                      <AlertTriangle className="h-3.5 w-3.5" /> mismatch. Request says {formatCurrency(Number(r.amount), r.currency)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatCurrency(check.sum, r.currency)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && !isLoading && !isError && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
              <p className="text-xs text-text-tertiary tabular-nums">
                Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalCount} request(s)
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pagination.totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty-state hint when nothing pending */}
      {!isLoading && !isError && statusTab === "PROCESSING" && requests.length === 0 && !debouncedSearch && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
          <Inbox className="h-3.5 w-3.5" /> Supplier requests will appear here during withdrawal windows
        </p>
      )}

      {action && modalConfig && (
        <ConfirmModal
          open
          title={modalConfig.title}
          description={modalConfig.description}
          confirmLabel={modalConfig.confirmLabel}
          icon={modalConfig.icon}
          loading={busy}
          confirmDisabled={busy || (action.kind === "complete" && (!!refError || !itemsCheck(action.request).matches))}
          onConfirm={handleConfirm}
          onCancel={() => setAction(null)}
        >
          {modalConfig.body}
          {action.kind !== "approve" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
              <Eye className="h-3.5 w-3.5" /> Expand the row above to double-check items before confirming.
            </p>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
