import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Calendar,
  CheckSquare,
  Clock,
  Hash,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/Pagination";
import { SectionError } from "@/components/shared/SectionError";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSIONS } from "@/lib/permissions";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import {
  approveCancellationRequest,
  batchApproveCancellationRequests,
  getCancellationErrorMessage,
  getCancellationErrorStatus,
  getCancellationRequests,
  rejectCancellationRequest,
} from "@/services/cancellationService";
import type {
  BatchApproveResult,
  CancellationRequest,
} from "@/services/cancellationService";
import { CancellationStatusBadge } from "@/components/cancellations/CancellationStatusBadge";
import { CancellationDecisionDialog } from "@/components/cancellations/CancellationDecisionDialog";
import { CancellationDetailDrawer } from "@/components/cancellations/CancellationDetailDrawer";
import { BatchApproveDialog } from "@/components/cancellations/BatchApproveDialog";

const STATUS_TABS = [
  { key: "PENDING_APPROVAL", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "WITHDRAWN", label: "Withdrawn" },
  { key: "SUPERSEDED", label: "Superseded" },
  { key: "ALL", label: "All" },
] as const;

const PAGE_LIMIT = 20;

const selectableStatuses = ["PENDING_APPROVAL", "APPROVING"];

function isSelectable(request: CancellationRequest): boolean {
  return selectableStatuses.includes(request.status);
}

export default function CancellationsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canDecide = can(PERMISSIONS.CANCELLATIONS_APPROVE);

  const [searchParams, setSearchParams] = useSearchParams();
  const [statusTab, setStatusTab] = useState<string>(searchParams.get("status") || "PENDING_APPROVAL");
  const [page, setPage] = useState(1);
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  // The URL is the source of truth for the open request, so bell/email deep
  // links (`?request=<id>`) work without a state-sync effect.
  const selectedId = searchParams.get("request");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<{ mode: "approve" | "reject"; request: CancellationRequest } | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchApproveResult | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(rawSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Keep the status tab in the URL so refresh/back preserves the view.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (statusTab === "PENDING_APPROVAL") params.delete("status");
    else params.set("status", statusTab);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  // Realtime: every admin notification push may be a new/decided request.
  useSocketInvalidate("admin-notification", ["admin", "cancellations"]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "cancellations", { status: statusTab, page, search }],
    queryFn: () =>
      getCancellationRequests({
        status: statusTab,
        page,
        limit: PAGE_LIMIT,
        search: search || undefined,
      }),
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const requests = useMemo(() => data?.requests ?? [], [data]);
  const pendingCount = data?.pendingCount ?? 0;
  const pagination = data?.pagination;

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "cancellations"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "cancellation-request"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
  }, [queryClient]);

  const handleConflict = useCallback(
    (err: unknown, fallback: string) => {
      toast.error(getCancellationErrorMessage(err, fallback));
      if (getCancellationErrorStatus(err) === 409) {
        // Already decided / superseded — the list is stale, pull fresh data.
        refreshAll();
      }
    },
    [refreshAll],
  );

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approveCancellationRequest(id, note ? { note } : {}),
    onSuccess: (res) => {
      toast.success(
        `Cancellation approved — full refund of ${formatCurrency(
          res.cancellation?.refundAmount ?? res.request?.preview?.refund?.amount ?? 0,
          res.booking?.currency || res.request?.booking?.currency || "USD",
        )} executed.`,
      );
      refreshAll();
      setDecision(null);
    },
    onError: (err: unknown) => {
      handleConflict(err, "Failed to approve cancellation request");
      setDecision(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectCancellationRequest(id, { note }),
    onSuccess: () => {
      toast.success("Cancellation request rejected — the booking is unchanged and blocked dates re-opened.");
      refreshAll();
      setDecision(null);
    },
    onError: (err: unknown) => {
      handleConflict(err, "Failed to reject cancellation request");
      setDecision(null);
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, note }: { ids: string[]; note: string }) =>
      batchApproveCancellationRequests(note ? { ids, note } : { ids }),
    onSuccess: (res) => {
      setBatchResults(res);
      refreshAll();
      setSelectedIds(new Set());
      if (res.failed === 0) toast.success(`${res.approved} cancellation${res.approved === 1 ? "" : "s"} approved.`);
      else toast.warning(`${res.approved} approved · ${res.failed} failed.`);
    },
    onError: (err: unknown) => {
      toast.error(getCancellationErrorMessage(err, "Batch approve failed"));
    },
  });

  const selectableRows = useMemo(() => requests.filter(isSelectable), [requests]);
  const selectedRequests = useMemo(
    () => selectableRows.filter((r) => selectedIds.has(r.id)),
    [selectableRows, selectedIds],
  );
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableRows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("request", id);
    setSearchParams(params, { replace: true });
  };

  const closeDetail = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("request");
    setSearchParams(params, { replace: true });
  };

  const confirmDecision = (note: string) => {
    if (!decision) return;
    if (decision.mode === "approve") approveMutation.mutate({ id: decision.request.id, note });
    else rejectMutation.mutate({ id: decision.request.id, note });
  };

  const activeTabLabel = STATUS_TABS.find((t) => t.key === statusTab)?.label?.toLowerCase() || "requests";

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Cancellations</h1>
            <p className="text-sm text-text-secondary">
              Supplier cancellation requests — approve to run the full refund path
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pendingCount > 0 ? "warning" : "secondary"} className="gap-1.5">
            <Clock className="h-3 w-3" />
            {pendingCount} pending
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.key;
          const count = tab.key === "PENDING_APPROVAL" ? pendingCount : tab.key === "ALL" ? pagination?.totalCount : null;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusTab(tab.key);
                setPage(1);
                setSelectedIds(new Set());
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface-base text-text-secondary hover:text-text-primary",
              )}
            >
              {tab.label}
              {count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-surface-muted text-text-tertiary",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + batch toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search booking #, customer, tour..."
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-10 pl-9"
          />
          {rawSearch && (
            <button
              onClick={() => setRawSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {canDecide && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
            <Button size="sm" className="h-7 gap-1.5" onClick={() => { setBatchResults(null); setBatchOpen(true); }}>
              Approve selected
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface-base overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-surface-muted/60">
                {canDecide && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all pending requests"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectableRows.length === 0}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </th>
                )}
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Booking</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tour / Supplier</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Customer</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Requested</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Reason</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-text-secondary">Refund / Fee</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-text-secondary">Stop-sell</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-secondary">Decided</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={canDecide ? 9 : 8} className="px-4 py-3">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={canDecide ? 9 : 8}>
                    <SectionError message="Failed to load cancellation requests" onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={canDecide ? 9 : 8}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted">
                        <Inbox className="h-6 w-6 text-text-tertiary" />
                      </div>
                      <p className="text-sm font-medium text-text-primary">No {activeTabLabel} requests</p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {search ? "Try a different search term" : "New supplier cancellation requests will appear here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const booking = request.booking;
                  const currency = booking?.currency || "USD";
                  const selectable = canDecide && isSelectable(request);
                  return (
                    <motion.tr
                      key={request.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => openDetail(request.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-muted/40",
                        selectedIds.has(request.id) && "bg-primary/5",
                      )}
                    >
                      {canDecide && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${booking?.bookingNumber || request.id}`}
                            checked={selectedIds.has(request.id)}
                            onChange={() => toggleOne(request.id)}
                            disabled={!selectable}
                            className="h-4 w-4 cursor-pointer rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-30"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3 w-3 text-text-tertiary" />
                          <span className="font-mono text-xs font-medium text-text-primary">
                            {booking?.bookingNumber || "—"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
                          <Calendar className="h-3 w-3" />
                          {booking?.travelDate ? new Date(booking.travelDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[220px]">
                          <Store className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-text-primary">{request.tour?.title || "—"}</p>
                            <p className="truncate text-[10px] text-text-tertiary">
                              {request.supplier?.name || request.tour?.supplier?.name || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0 text-text-tertiary" />
                          <div className="min-w-0">
                            <p className="truncate text-xs text-text-primary">{booking?.customer?.name || "—"}</p>
                            <p className="truncate text-[10px] text-text-tertiary">{booking?.customer?.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-text-secondary">{timeAgo(request.createdAt)}</p>
                        <div className="mt-1">
                          <CancellationStatusBadge status={request.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium capitalize text-text-primary">
                          {(request.payload?.cancellationCategory || booking?.cancellationCategory || "—")
                            .toString()
                            .replace(/_/g, " ")
                            .toLowerCase()}
                        </p>
                        <p className="font-mono text-[10px] text-text-tertiary">
                          {request.payload?.cancellationCode || booking?.cancellationCode || "—"}
                        </p>
                        {request.payload?.explanation ? (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-text-tertiary line-clamp-1 max-w-[200px]">
                            <MessageSquare className="h-3 w-3 shrink-0" />
                            {String(request.payload.explanation)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-semibold text-text-primary tabular-nums">
                          {formatCurrency(request.preview?.refund?.amount ?? 0, currency)}
                        </p>
                        <p className="text-[10px] text-text-tertiary tabular-nums">
                          fee {formatCurrency(request.preview?.fee ?? 0, currency)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {request.stopSellingApplied ? (
                          <Badge variant="warning" className="text-[10px]">Applied</Badge>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {request.decidedAt ? (
                          <>
                            <p className="text-xs text-text-primary">{request.decidedBy?.name || request.decidedBy?.email || "—"}</p>
                            <p className="text-[10px] text-text-tertiary">{timeAgo(request.decidedAt)}</p>
                            {request.decisionNote ? (
                              <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-text-tertiary" title={request.decisionNote}>
                                {request.decisionNote}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">Awaiting decision</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={pagination.limit}
          onPageChange={setPage}
        />
      )}

      <CancellationDetailDrawer
        requestId={selectedId}
        canDecide={canDecide}
        onClose={closeDetail}
        onApprove={(request) => setDecision({ mode: "approve", request })}
        onReject={(request) => setDecision({ mode: "reject", request })}
      />

      {decision && (
        <CancellationDecisionDialog
          open
          mode={decision.mode}
          request={decision.request}
          loading={approveMutation.isPending || rejectMutation.isPending}
          onCancel={() => setDecision(null)}
          onConfirm={confirmDecision}
        />
      )}

      {batchOpen && (
        <BatchApproveDialog
          open
          requests={selectedRequests}
          loading={batchMutation.isPending}
          results={batchResults}
          onCancel={() => { setBatchOpen(false); setBatchResults(null); }}
          onConfirm={(note) => batchMutation.mutate({ ids: selectedRequests.map((r) => r.id), note })}
        />
      )}
    </div>
  );
}
