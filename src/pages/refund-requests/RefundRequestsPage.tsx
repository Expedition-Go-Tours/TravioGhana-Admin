import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { PayoutStatusTabs } from "@/components/payouts/PayoutStatusTabs";
import { Pagination } from "@/components/shared/Pagination";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SectionError } from "@/components/shared/SectionError";
import { usePermission } from "@/hooks/usePermission";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  STATUS_LABEL,
  approveRefundRequest,
  getRefundRequest,
  listRefundRequests,
  rejectRefundRequest,
  type RefundRequestStatus,
  type SupplierRefundRequest,
} from "@/services/refundRequestService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TABS: Array<{ key: string; label: string }> = [
  { key: "PENDING_APPROVAL", label: "Pending" },
  { key: "EXECUTING", label: "Processing" },
  { key: "COMPLETED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "FAILED", label: "Failed" },
  { key: "WITHDRAWN", label: "Withdrawn" },
  { key: "ALL", label: "All" },
];

const STATUS_CHIP: Record<RefundRequestStatus, string> = {
  PENDING_APPROVAL: "border-status-pending/25 bg-status-pending/10 text-status-pending-text",
  EXECUTING: "border-status-processing/25 bg-status-processing/10 text-status-processing-text",
  COMPLETED: "border-primary/20 bg-primary/10 text-primary",
  REJECTED: "border-status-rejected/25 bg-status-rejected/10 text-status-rejected-text",
  WITHDRAWN: "border-border bg-surface-muted text-text-secondary",
  FAILED: "border-status-rejected/25 bg-status-rejected/10 text-status-rejected-text",
};

const LIMIT = 20;

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

function money(value: number | null | undefined, currency = "USD") {
  return formatCurrency(Number(value || 0), currency);
}

function humanize(value?: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function RefundStatusChip({ status }: { status: RefundRequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_CHIP[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
      {children}
    </p>
  );
}

function DetailValue({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-1 text-[13px] text-text-primary", className)}>{children}</div>;
}

export default function RefundRequestsPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const canDecide = can("payouts.approve");

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("request");
  const [manualOpenId, setManualOpenId] = useState<string | null>(null);
  const openId = manualOpenId ?? requestedId;

  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const listQuery = useQuery({
    queryKey: ["admin", "refund-requests", status, page, debouncedSearch],
    queryFn: () =>
      listRefundRequests({ status, page, limit: LIMIT, search: debouncedSearch || undefined }),
    refetchInterval: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "refund-requests", "detail", openId],
    queryFn: () => getRefundRequest(openId as string),
    enabled: !!openId,
  });

  const rows = listQuery.data?.requests ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const detail = detailQuery.data;
  const preview = detail?.live || detail?.preview || null;
  const currency = preview?.currency || detail?.booking?.currency || "USD";

  const balanceAfter = useMemo(() => {
    if (!detail?.supplierBalance || !preview) return null;
    return detail.supplierBalance.available - Number(preview.charge || 0);
  }, [detail, preview]);

  function clearRequestedParam() {
    if (!requestedId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("request");
    setSearchParams(next, { replace: true });
  }

  function close() {
    setManualOpenId(null);
    setNote("");
    setError(null);
    clearRequestedParam();
  }

  function openRequest(id: string) {
    setManualOpenId(id);
    setNote("");
    setError(null);
    clearRequestedParam();
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin", "refund-requests"] });
    close();
  }

  const approve = useMutation({
    mutationFn: () => approveRefundRequest(openId as string, note.trim() || undefined),
    onSuccess: () => {
      toast.success("Refund approved — the traveller refund is being processed");
      refresh();
    },
    onError: (err: unknown) => setError(errorMessage(err, "Could not approve the refund.")),
  });

  const reject = useMutation({
    mutationFn: () => rejectRefundRequest(openId as string, note.trim()),
    onSuccess: () => {
      toast.success("Refund request rejected");
      refresh();
    },
    onError: (err: unknown) => setError(errorMessage(err, "Could not reject the request.")),
  });

  function changeStatus(next: string) {
    setStatus(next);
    setPage(1);
    close();
  }

  const columns: Column<SupplierRefundRequest>[] = [
    {
      key: "requestNumber",
      header: "Request",
      rowHeader: true,
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-text-primary">{row.requestNumber}</p>
          <p className="mt-1 text-[11px] text-text-tertiary">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">
            {row.supplier?.name || "Unknown supplier"}
          </p>
          {row.supplier?.email && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-tertiary">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{row.supplier.email}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: "booking",
      header: "Booking",
      hideBelow: "md",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">
            {row.booking?.bookingNumber || "—"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {row.booking?.tourTitle || "—"}
            {row.booking?.travelDate ? ` · ${formatDate(row.booking.travelDate)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "refund",
      header: "Refund",
      numeric: true,
      render: (row) => (
        <div>
          <p className="tnum text-[13px] font-semibold text-text-primary">
            {money(row.preview?.proposed, row.preview?.currency || row.booking?.currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {row.preview?.isFull ? "Full refund" : "Partial refund"}
          </p>
        </div>
      ),
    },
    {
      key: "charge",
      header: "Supplier charge",
      numeric: true,
      hideBelow: "lg",
      render: (row) => (
        <span className="tnum text-[13px] text-text-secondary">
          {money(row.preview?.charge, row.preview?.currency || row.booking?.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <RefundStatusChip status={row.status} />,
    },
  ];

  const activeLabel = TABS.find((tab) => tab.key === status)?.label ?? status;
  const emptyMessage = debouncedSearch
    ? `No refund requests match “${debouncedSearch}”`
    : status === "ALL"
      ? "No refund requests"
      : `No ${activeLabel.toLowerCase()} refund requests`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Refund requests"
        subtitle="Supplier refunds on delivered trips. Approving refunds the traveller and charges the supplier's balance."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", listQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      <PayoutStatusTabs
        tabs={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
        active={status}
        onChange={changeStatus}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border px-5 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search request or booking number"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8"
                aria-label="Search refund requests"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              {listQuery.isLoading
                ? "Loading requests"
                : `${total} ${total === 1 ? "request" : "requests"}${status === "ALL" ? "" : ` · ${activeLabel}`}`}
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={rows}
              loading={listQuery.isLoading}
              error={listQuery.isError ? "Could not load refund requests." : null}
              onRetry={() => listQuery.refetch()}
              keyExtractor={(row) => row.id}
              onRowClick={(row) => openRequest(row.id)}
              size="dense"
              emptyMessage={emptyMessage}
              pagination={
                total > LIMIT
                  ? {
                      page,
                      totalPages,
                      totalCount: total,
                      onPageChange: setPage,
                    }
                  : undefined
              }
            />
          </div>

          <div className="md:hidden">
            {listQuery.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-border p-4">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="mt-2 h-4 w-44" />
                    <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                  </div>
                ))}
              </div>
            ) : listQuery.isError ? (
              <div className="p-4">
                <SectionError message="Could not load refund requests." onRetry={() => listQuery.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <SectionEmpty message={emptyMessage} />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openRequest(row.id)}
                    className="flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-semibold text-text-primary">
                          {row.requestNumber}
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium text-text-primary">
                          {row.supplier?.name || "Unknown supplier"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
                          {row.booking?.tourTitle || "—"}
                          {row.booking?.bookingNumber ? ` · ${row.booking.bookingNumber}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-tertiary">
                          Filed {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <RefundStatusChip status={row.status} />
                    </div>
                    <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                          Refund
                        </p>
                        <p className="tnum mt-0.5 text-[13px] font-semibold text-text-primary">
                          {money(
                            row.preview?.proposed,
                            row.preview?.currency || row.booking?.currency,
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                          Supplier charge
                        </p>
                        <p className="tnum mt-0.5 text-[13px] text-text-secondary">
                          {money(
                            row.preview?.charge,
                            row.preview?.currency || row.booking?.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {total > LIMIT && !listQuery.isLoading && !listQuery.isError && (
              <div className="border-t border-border px-4 py-3">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalCount={total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-surface-base px-5 py-5 text-left sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-text-tertiary">Refund request</p>
                <DialogTitle className="mt-1 font-mono text-base">
                  {detail?.requestNumber || (openId ? "Loading…" : "Refund request")}
                </DialogTitle>
                <DialogDescription className="mt-1.5">
                  {detail?.booking?.tourTitle || "Booking refund"}
                  {detail?.booking?.bookingNumber ? ` · ${detail.booking.bookingNumber}` : ""}
                </DialogDescription>
              </div>
              {detail && (
                <div className="shrink-0 pr-8">
                  <RefundStatusChip status={detail.status} />
                </div>
              )}
            </div>
          </DialogHeader>

          {detailQuery.isLoading || !detail ? (
            <div className="space-y-4 px-5 py-6 sm:px-6">
              {detailQuery.isError ? (
                <div className="rounded-lg border border-status-rejected/25 bg-status-rejected/5 px-4 py-4 text-sm text-status-rejected-text">
                  {errorMessage(detailQuery.error, "Could not load this request.")}
                </div>
              ) : (
                <>
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-surface-muted px-3.5 py-3">
                    <DetailLabel>Traveller refund</DetailLabel>
                    <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-text-primary">
                      {money(preview?.proposed, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      {preview?.isFull ? "Full booking refund" : "Partial refund"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-muted px-3.5 py-3">
                    <DetailLabel>Charge to supplier</DetailLabel>
                    <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-text-primary">
                      {money(preview?.charge, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      Netted off their next payout
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border px-3.5 py-3">
                    <DetailLabel>Booking</DetailLabel>
                    <DetailValue className="font-medium">
                      {detail.booking?.bookingNumber || "—"}
                    </DetailValue>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                      <CalendarDays className="h-3 w-3" />
                      Travel {detail.booking?.travelDate ? formatDate(detail.booking.travelDate) : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      Total {money(preview?.gross, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border px-3.5 py-3">
                    <DetailLabel>Refundable</DetailLabel>
                    <DetailValue className="font-medium">
                      {money(preview?.refundable, currency)}
                    </DetailValue>
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      Already refunded {money(preview?.refundedSoFar, currency)}
                    </p>
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      Supplier payout {money(preview?.supplierPayout, currency)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DetailLabel>Supplier's request</DetailLabel>
                    <span className="text-[11px] text-text-tertiary">
                      Filed {formatDate(detail.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {detail.payload?.refundType === "PERCENT"
                        ? `${detail.payload?.value}%`
                        : money(detail.payload?.value, currency)}
                    </span>
                    {" · "}
                    {humanize(detail.payload?.reasonCode)}
                  </p>
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    Tour operated: {detail.payload?.operated ? "Yes" : "No"} · Customer attended:{" "}
                    {detail.payload?.attended ? "Yes" : "No"}
                  </p>
                  {detail.payload?.note && (
                    <p className="mt-2.5 rounded-md bg-surface-muted px-3 py-2 text-[13px] leading-relaxed text-text-secondary">
                      “{detail.payload.note}”
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-text-tertiary">
                    {detail.payload?.requestedByEmail || detail.supplier?.email || "Supplier"}
                  </p>
                </div>

                {detail.supplierBalance && (
                  <div className="rounded-lg border border-border px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-text-tertiary" />
                      <DetailLabel>Supplier balance</DetailLabel>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[13px] text-text-secondary">Available now</span>
                      <span className="tnum text-sm font-semibold text-text-primary">
                        {money(detail.supplierBalance.available, currency)}
                      </span>
                      {balanceAfter !== null && (
                        <>
                          <span className="text-text-tertiary">→</span>
                          <span
                            className={cn(
                              "tnum text-sm font-semibold",
                              balanceAfter < 0 ? "text-status-rejected-text" : "text-primary",
                            )}
                          >
                            {money(balanceAfter, currency)} after refund
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-text-tertiary">
                      The charge is netted off the next payout — it is never taken from their bank
                      account.
                    </p>
                    {balanceAfter !== null && balanceAfter < 0 && (
                      <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-status-pending/10 px-3 py-2 text-xs leading-relaxed text-status-pending-text">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        This pushes the supplier's balance negative. That is allowed — the traveller
                        is still owed the refund — but their next payout is held until it clears.
                      </p>
                    )}
                  </div>
                )}

                {detail.blocked && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-status-rejected/25 bg-status-rejected/5 px-4 py-3 text-[13px] text-status-rejected-text">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {detail.blocked}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-status-rejected/25 bg-status-rejected/5 px-4 py-3 text-[13px] text-status-rejected-text">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {detail.decisionNote && (
                  <div className="rounded-lg border border-border px-4 py-3">
                    <DetailLabel>Decision note</DetailLabel>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                      {detail.decisionNote}
                    </p>
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      {detail.decidedAt ? formatDate(detail.decidedAt) : ""}
                      {detail.refundReference ? ` · ${detail.refundReference}` : ""}
                    </p>
                  </div>
                )}
              </div>

              {detail.status === "PENDING_APPROVAL" ? (
                canDecide ? (
                  <div className="sticky bottom-0 border-t border-border bg-surface-base px-5 py-4 sm:px-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="decision-note">Decision note</Label>
                      <Textarea
                        id="decision-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        placeholder="Context for the supplier, or why this is being declined."
                      />
                      <p className="text-[11px] text-text-tertiary">
                        A note is required to reject the request.
                      </p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        disabled={reject.isPending || approve.isPending || !note.trim()}
                        onClick={() => reject.mutate()}
                        className="gap-2"
                      >
                        {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Reject request
                      </Button>
                      <Button
                        disabled={approve.isPending || reject.isPending || !!detail.blocked}
                        onClick={() => approve.mutate()}
                        className="gap-2"
                      >
                        {approve.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Approve &amp; refund
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border bg-surface-muted px-5 py-4 text-[13px] text-text-secondary sm:px-6">
                    You can review this request, but approving a refund needs the{" "}
                    <span className="font-medium text-text-primary">payouts.approve</span> permission.
                  </div>
                )
              ) : (
                <div className="border-t border-border bg-surface-muted px-5 py-4 text-[13px] text-text-secondary sm:px-6">
                  This request is {STATUS_LABEL[detail.status].toLowerCase()}. No further action is needed.
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
