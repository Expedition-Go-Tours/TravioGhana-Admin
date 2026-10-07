import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Ban, CheckCircle, Clock, Inbox, Landmark, Search, Send,
  ShieldCheck, Smartphone, Wallet, X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { PayoutStatusTabs } from "@/components/payouts/PayoutStatusTabs";
import { usePermission } from "@/hooks/usePermission";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate, formatDateTime, getStatusColor } from "@/lib/utils";
import { validateReference } from "@/pages/finance/reference";
import type { Invoice, InvoiceItem } from "@/types/payout";

/**
 * Finance v3 invoice queue — the payout side of GetYourGuide-style automatic
 * invoicing.
 *
 * Invoices generate on each supplier's cadence (activity-date window → invoice
 * date → payment date). Finance approves them first — a maker–checker step
 * that authorizes the transfer (INVOICED → APPROVED) — then pays by
 * bank/mobile money and records the real reference, which is what moves the
 * invoice out of the supplier's balance. Money movement stays manual — no
 * provider API — so the reference is required, never free text we invent for
 * them. An invoice can only be marked paid after it is approved; there is no
 * auto-approval job.
 */

const STATUS_TABS = [
  { key: "INVOICED", label: "Due" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Voided" },
] as const;

/**
 * Carbon's status-indicator rule: icon + word + colour, so state is never
 * carried by hue alone. `getStatusColor` has no `INVOICED`/`APPROVED` entry,
 * so the Due and Approved chips bring their own colour — unpaid money must not
 * render as neutral grey.
 */
const STATUS_META: Record<string, { label: string; Icon: typeof Clock }> = {
  INVOICED: { label: "Due", Icon: Clock },
  APPROVED: { label: "Approved", Icon: ShieldCheck },
  PAID: { label: "Paid", Icon: CheckCircle },
  CANCELLED: { label: "Voided", Icon: Ban },
};

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const meta = STATUS_META[status] || { label: status, Icon: Clock };
  const { Icon, label } = meta;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        getStatusColor(status),
        status === "INVOICED" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        status === "APPROVED" && "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

function methodDetail(m: Invoice["payoutMethod"]): string | null {
  if (!m) return null;
  if (m.type === "PAYPAL") return m.paypalEmail || null;
  if (m.type === "BANK_TRANSFER") return m.bankName || m.accountNumber?.slice(-4) || null;
  if (m.type === "MOBILE_MONEY") return [m.mobileProvider, m.mobileNumber].filter(Boolean).join(" ") || null;
  return m.accountName || null;
}

/** Mobile money is a first-class destination here, so it gets its own glyph. */
function MethodLabel({ invoice }: { invoice: Invoice }) {
  const m = invoice.payoutMethod;
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

/** Cross-check: the line items' supplier payouts must equal the invoice net. */
function itemsCheck(inv: Invoice) {
  const sum = (inv.items || []).reduce((s, it) => s + Number(it.supplierPayout || 0), 0);
  return { sum, matches: Math.abs(sum - Number(inv.netTotal || 0)) < 0.01 };
}

/**
 * Effective commission rate for an invoice, derived from its frozen numbers.
 * History is mixed (17% before the flat-15% change, 15% after), so the label
 * reads the rate off the invoice instead of hard-coding one.
 */
function commissionRate(inv: Invoice): number {
  const gross = Number(inv.grossTotal || 0);
  const commission = Number(inv.commissionTotal || 0);
  return gross > 0 ? Math.round((commission / gross) * 100) : 0;
}

/**
 * The receipt behind an invoice row: destination, processing timeline, the
 * gross → commission → net derivation, the activity-date window it covers, and
 * the bookings it bills for — with the items total reconciled against the
 * invoice instead of being trusted.
 */
function InvoiceDetail({ invoice: inv, loading }: { invoice: Invoice; loading?: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  const check = itemsCheck(inv);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Destination</p>
          <div className="mt-1.5"><MethodLabel invoice={inv} /></div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Timeline</p>
          <p className="mt-1.5 text-sm text-text-secondary">
            Invoiced {formatDateTime(inv.invoicedAt)}
            {(inv.status === "INVOICED" || inv.status === "APPROVED") && inv.paymentScheduledAt && ` · pay by ${formatDate(inv.paymentScheduledAt)}`}
            {inv.approvedAt && ` · approved ${formatDate(inv.approvedAt)}`}
            {inv.paidAt && ` · paid ${formatDate(inv.paidAt)}`}
            {inv.status === "CANCELLED" && " · voided"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Reference</p>
          {inv.reference ? (
            <p className="mt-1.5 font-mono text-sm text-text-primary">{inv.reference}</p>
          ) : inv.status === "INVOICED" || inv.status === "APPROVED" ? (
            <p className="mt-1.5 text-sm italic text-text-tertiary">Recorded when marked as paid</p>
          ) : (
            <p className="mt-1.5 text-sm text-text-tertiary">—</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-surface-base p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Gross</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(Number(inv.grossTotal), inv.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-base p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Commission ({commissionRate(inv)}%)
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(Number(inv.commissionTotal), inv.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-base p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Net to supplier</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(Number(inv.netTotal), inv.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-base p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Activity dates</p>
          <p className="mt-0.5 text-sm text-text-secondary">
            {formatDate(inv.cycleStartDate)} – {formatDate(inv.cycleEndDate)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60 bg-surface-base">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Bookings billed on invoice {inv.invoiceNumber}
          </caption>
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
              <th className="px-4 py-2 font-semibold">Booking</th>
              <th className="px-4 py-2 font-semibold">Tour</th>
              <th className="px-4 py-2 font-semibold">Travel date</th>
              <th className="px-4 py-2 text-right font-semibold">Gross</th>
              <th className="px-4 py-2 text-right font-semibold">Commission</th>
              <th className="px-4 py-2 text-right font-semibold">Supplier payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {(inv.items || []).map((it: InvoiceItem) => (
              <tr key={it.id}>
                <td className="px-4 py-2 font-mono text-xs text-primary">
                  {it.booking?.bookingNumber || it.bookingId}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2 text-text-secondary">
                  {it.booking?.tour?.title || "—"}
                </td>
                <td className="px-4 py-2 text-text-tertiary">
                  {it.booking?.travelDate ? formatDate(it.booking.travelDate) : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-text-secondary">
                  {formatCurrency(Number(it.grossAmount || 0), it.currency)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-text-secondary">
                  {formatCurrency(Number(it.platformCommission || 0), it.currency)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(Number(it.supplierPayout || 0), it.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60">
              <td colSpan={4} className="px-4 py-2 text-right text-[11px] uppercase tracking-wider text-text-tertiary">
                Items total ·{" "}
                {check.matches ? (
                  <span className="inline-flex items-center gap-1 normal-case text-status-active-text">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> matches invoice
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold normal-case text-status-rejected-text">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> mismatch. Invoice says{" "}
                    {formatCurrency(Number(inv.netTotal), inv.currency)}
                  </span>
                )}
              </td>
              <td colSpan={2} className="px-4 py-2 text-right font-semibold tabular-nums">
                {formatCurrency(check.sum, inv.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function InvoicesTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const [statusTab, setStatusTab] = useState<string>("INVOICED");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("invoicedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [paidReference, setPaidReference] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSort = (key: string) => {
    // Clicking the active column flips direction; a new column starts descending.
    if (key === sortBy) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const statusParam = statusTab === "ALL" ? "" : statusTab;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "invoices", statusParam, page, debouncedSearch, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder });
      if (statusParam) params.set("status", statusParam);
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api.get(`/admin/finance/invoices?${params.toString()}`).then((r) => r.data);
    },
    placeholderData: (prev) => prev,
  });

  const invoices = useMemo(() => (data?.data?.invoices || []) as Invoice[], [data]);
  const pagination = data?.data?.pagination;
  const summary = data?.data?.summary as
    { statusCounts?: Record<string, number>; totalCount?: number; totalAmount?: number }
    | undefined;

  // Full invoice (line items with customers) fetched once, on expand.
  const detailQuery = useQuery({
    queryKey: ["admin", "invoice", expandedId],
    queryFn: () => api.get(`/admin/finance/invoices/${expandedId}`).then((r) => r.data),
    enabled: !!expandedId,
  });
  const detailInvoice = (detailQuery.data?.data?.invoice || null) as Invoice | null;
  const expandedListInvoice = invoices.find((i) => i.id === expandedId) || null;
  const expandedInvoice = detailInvoice || expandedListInvoice;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "invoice"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary"] });
  };

  const markPaidMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      api.patch(`/admin/finance/invoices/${id}/mark-paid`, { reference }),
    onSuccess: () => {
      toast.success("Invoice marked as paid; supplier balance updated");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to mark invoice as paid",
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/finance/invoices/${id}/approve`),
    onSuccess: () => {
      toast.success("Invoice approved — ready to send the transfer");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to approve invoice",
      ),
  });

  // Pessimistic, never optimistic: these flip money in or out of the balance.
  const busy = markPaidMutation.isPending || approveMutation.isPending;
  const refError = validateReference(paidReference);
  const markingInvoice = invoices.find((i) => i.id === markingId) || null;
  const approvingInvoice = invoices.find((i) => i.id === approvingId) || null;

  const openMarkPaid = (inv: Invoice) => {
    setPaidReference("");
    setMarkingId(inv.id);
  };

  const handleMarkPaid = () => {
    if (!markingInvoice) return;
    const error = validateReference(paidReference);
    if (error) {
      toast.error(error);
      return;
    }
    markPaidMutation.mutate(
      { id: markingInvoice.id, reference: paidReference.trim().replace(/\s+/g, " ") },
      { onSettled: () => setMarkingId(null) },
    );
  };

  const switchTab = (key: string) => {
    setStatusTab(key);
    setPage(1);
    setExpandedId(null);
  };

  const statusTabs = useMemo(() => {
    const counts = summary?.statusCounts || {};
    return [
      { key: "ALL", label: "All", count: summary?.totalCount ?? 0 },
      ...STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] ?? 0 })),
    ];
  }, [summary]);

  const activeLabel =
    statusTab === "ALL"
      ? "all"
      : STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase() || "all";
  const activeCount =
    statusTab === "ALL"
      ? summary?.totalCount ?? invoices.length
      : summary?.statusCounts?.[statusTab] ?? invoices.length;

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      rowHeader: true,
      sortable: true,
      render: (inv) => (
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</span>
          {!inv.payoutMethod?.type && (inv.status === "INVOICED" || inv.status === "APPROVED") && (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-rejected/10 px-1.5 py-0.5 text-[11px] font-semibold text-status-rejected-text">
              <AlertTriangle className="h-3 w-3" aria-hidden /> No method
            </span>
          )}
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (inv) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {inv.supplier?.name || inv.supplier?.email || "Unknown supplier"}
          </p>
          <p className="truncate text-xs text-text-tertiary">{inv.supplier?.email}</p>
        </div>
      ),
    },
    {
      key: "cycle",
      header: "Cycle",
      hideBelow: "lg",
      render: (inv) => <span className="whitespace-nowrap text-sm text-text-secondary">{inv.cycleLabel}</span>,
    },
    {
      key: "bookingCount",
      header: "Bookings",
      numeric: true,
      render: (inv) => <span className="text-sm tabular-nums text-text-secondary">{inv.bookingCount}</span>,
    },
    {
      key: "netTotal",
      header: "Net to supplier",
      numeric: true,
      sortable: true,
      render: (inv) => (
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          {formatCurrency(Number(inv.netTotal), inv.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (inv) => <InvoiceStatusBadge status={inv.status} />,
    },
    {
      key: "invoicedAt",
      header: "Invoiced",
      numeric: true,
      sortable: true,
      hideBelow: "md",
      render: (inv) => (
        <div className="flex flex-col text-sm tabular-nums text-text-secondary">
          <span>{formatDate(inv.invoicedAt)}</span>
          <span className="text-xs text-text-tertiary">
            {inv.status === "PAID"
              ? `Paid ${formatDate(inv.paidAt || "")}`
              : inv.status === "CANCELLED"
                ? "Voided"
                : `Pay by ${formatDate(inv.paymentScheduledAt)}`}
          </span>
        </div>
      ),
    },
    {
      // Primer: the column holding row actions has no visible header.
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (inv) => {
        if (!can("payouts.approve")) return null;
        if (inv.status === "INVOICED") {
          // Maker–checker: approve first, then the money can move. No money
          // changes here — this only authorizes the later transfer.
          return (
            <Button
              size="sm"
              className="gap-1"
              disabled={busy}
              aria-label={`Approve invoice ${inv.invoiceNumber} for payment`}
              onClick={() => setApprovingId(inv.id)}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Approve
            </Button>
          );
        }
        if (inv.status === "APPROVED") {
          return (
            <Button
              size="sm"
              className="gap-1"
              disabled={busy}
              aria-label={`Mark invoice ${inv.invoiceNumber} as paid`}
              onClick={() => openMarkPaid(inv)}
            >
              <Send className="h-3.5 w-3.5" aria-hidden /> Mark paid
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* True totals across all statuses for the current search — the counts on
          the tabs are per-status, this is the pot they add up to. */}
      {!isLoading && !isError && (summary?.totalCount ?? 0) > 0 && (
        <p className={cn("text-xs tabular-nums text-text-tertiary transition-opacity", isFetching && "opacity-50")}>
          {summary?.totalCount} invoice{summary?.totalCount === 1 ? "" : "s"} across all statuses ·{" "}
          {formatCurrency(summary?.totalAmount ?? 0)} net · showing {activeCount} {activeLabel}
        </p>
      )}

      <Card>
        <CardHeader className="border-b border-border px-5 pb-4 pt-5">
          <PayoutStatusTabs
            tabs={statusTabs}
            active={statusTab}
            onChange={switchTab}
            className="-mx-5 -mt-5 mb-4 px-5 pt-4"
          />
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input
              placeholder="Search invoice #, reference or supplier…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 pr-8"
              aria-label="Search invoices"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4">
          <DataTable
            columns={columns}
            data={invoices}
            loading={isLoading}
            error={isError ? "Failed to load invoices" : null}
            onRetry={() => refetch()}
            keyExtractor={(inv) => inv.id}
            caption={`Supplier invoices — ${activeLabel}`}
            size="dense"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            expandedRow={expandedId}
            onRowClick={(inv) => setExpandedId(expandedId === inv.id ? null : inv.id)}
            renderExpanded={(inv) => (
              <InvoiceDetail
                invoice={expandedInvoice?.id === inv.id ? expandedInvoice : inv}
                loading={detailQuery.isLoading && expandedId === inv.id}
              />
            )}
            pagination={pagination ? {
              page: pagination.currentPage || page,
              totalPages: pagination.totalPages || 1,
              totalCount: pagination.totalCount || 0,
              onPageChange: setPage,
            } : undefined}
            emptyMessage={
              debouncedSearch
                ? `No invoices match “${debouncedSearch}”`
                : statusTab === "INVOICED"
                  ? "No invoices due — invoices generate automatically on each supplier's invoice date"
                  : statusTab === "APPROVED"
                    ? "No approved invoices waiting — approve due invoices to authorize their transfer"
                    : statusTab === "PAID"
                    ? "No paid invoices yet"
                    : statusTab === "CANCELLED"
                      ? "No voided invoices"
                      : "No invoices yet — they generate automatically on each supplier's invoice date"
            }
          />
        </CardContent>
      </Card>

      {/* Empty-state hint: nothing is wrong, the date just hasn't arrived. */}
      {!isLoading && !isError && statusTab !== "PAID" && invoices.length === 0 && !debouncedSearch && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
          <Inbox className="h-3.5 w-3.5" aria-hidden />
          Invoices appear here on each supplier's invoice date, covering activity up to the day before
        </p>
      )}

      {approvingInvoice && (
        <ConfirmModal
          open
          title="Approve invoice for payment"
          description={`This authorizes the transfer: ${approvingInvoice.invoiceNumber} (${formatCurrency(
            Number(approvingInvoice.netTotal),
            approvingInvoice.currency,
          )} to ${approvingInvoice.supplier?.name || "supplier"}). Approval takes the invoice from Due to Approved; the money only leaves after you mark it paid with the real bank reference.`}
          confirmLabel="Approve"
          icon="publish"
          loading={approveMutation.isPending}
          confirmDisabled={approveMutation.isPending}
          onConfirm={() =>
            approveMutation.mutate(approvingInvoice.id, { onSettled: () => setApprovingId(null) })
          }
          onCancel={() => setApprovingId(null)}
        >
          <p className="text-sm text-text-secondary">
            Approving does not move money — it records who authorized the payout and when.
          </p>
        </ConfirmModal>
      )}

      {markingInvoice && (
        <ConfirmModal
          open
          title="Mark invoice as paid"
          description={`This is final: ${markingInvoice.invoiceNumber} (${formatCurrency(
            Number(markingInvoice.netTotal),
            markingInvoice.currency,
          )} to ${markingInvoice.supplier?.name || "supplier"}) leaves the supplier's balance and its bookings flip to PAID.`}
          confirmLabel="Confirm paid"
          icon="publish"
          loading={busy}
          confirmDisabled={busy || !!refError || !paidReference.trim()}
          onConfirm={handleMarkPaid}
          onCancel={() => setMarkingId(null)}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Paying to</p>
              <div className="mt-1.5"><MethodLabel invoice={markingInvoice} /></div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Only mark paid after the real bank/mobile-money transfer has been sent. Record the exact reference
                your bank confirms — the supplier sees it on their invoice.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-reference">Transaction reference (required)</Label>
              <Input
                id="invoice-reference"
                placeholder="e.g. TRX-8841209 or bank transfer ref"
                value={paidReference}
                onChange={(e) => setPaidReference(e.target.value)}
                aria-invalid={!!refError && paidReference.length > 0}
                aria-describedby={refError && paidReference.length > 0 ? "invoice-reference-error" : undefined}
              />
              {refError && paidReference.length > 0 && (
                <p id="invoice-reference-error" className="text-xs font-medium text-status-rejected-text">{refError}</p>
              )}
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
