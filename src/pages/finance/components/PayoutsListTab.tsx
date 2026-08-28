import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Search, X, Eye, MapPin, Hash, Building2, Wallet, Calendar, DollarSign, Receipt, Percent, Clock, Send, ArrowUpRight, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { StatCard } from "@/components/shared/StatCard";
import { PayoutStatusTabs } from "@/components/payouts/PayoutStatusTabs";
import { usePermission } from "@/hooks/usePermission";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import { PayoutDetailPanel } from "./PayoutDetailPanel";
import api from "@/lib/axios";
import { cn, formatCurrency, formatNumber, truncateId } from "@/lib/utils";
import type { Payout } from "@/types/payout";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface PayoutMethod {
  id: string;
  type?: string;
  details?: string;
  isDefault?: boolean;
}

const STATUS_ORDER = ["PENDING", "APPROVED", "PROCESSING", "PAID", "FAILED", "CANCELLED"] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

interface PayoutsListTabProps {
  initialStatus?: string;
  onStatusChange?: (status: string | undefined) => void;
}

export function PayoutsListTab({ initialStatus, onStatusChange }: PayoutsListTabProps) {
  const queryClient = useQueryClient();
  const { can } = usePermission();

  useSocketInvalidate("admin:payout-update", ["admin", "payouts"]);

  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusTab, setStatusTab] = useState<string>(initialStatus || "ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [actionPayout, setActionPayout] = useState<Payout | null>(null);
  const [actionType, setActionType] = useState<"approve" | "release" | "settle" | "fail" | null>(null);
  const [failReason, setFailReason] = useState("");
  const [releaseMethod, setReleaseMethod] = useState("");
  const [releaseReference, setReleaseReference] = useState("");
  const [settleReference, setSettleReference] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const deepLinkHandled = useRef(false);
  const [detailPayout, setDetailPayout] = useState<Payout | null>(null);
  const [detailPayoutPhoto, setDetailPayoutPhoto] = useState<string | undefined>(undefined);
  const [highlightedPayoutId, setHighlightedPayoutId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const statusParam = statusTab === "ALL" ? "" : statusTab;

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusParam) params.set("status", statusParam);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [page, statusParam, debouncedSearch, supplierFilter, startDate, endDate]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payouts", { q: queryParams }],
    queryFn: () => api.get(`/payouts/admin?${queryParams}`).then((r) => r.data),
  });

  const { data: methodsData } = useQuery({
    queryKey: ["admin", "payout-methods", "supplier", actionPayout?.supplier?.id],
    queryFn: () => api.get(`/payout-methods/admin/suppliers/${actionPayout?.supplier?.id}`).then((r) => r.data),
    enabled: actionType === "release" && !!actionPayout?.supplier?.id && can("payout-methods.view"),
  });

  const { data: supplierOptions = [] } = useQuery<Array<{ id: string; name?: string; email?: string }>>({
    queryKey: ["admin", "suppliers", "options"],
    queryFn: async () => {
      const res = await api.get("/suppliers/admin/applications?limit=1000");
      const list = res.data?.data?.applications || res.data?.applications || [];
      return (list as Array<{ user?: { id: string; name?: string; email?: string } }>)
        .filter((s) => s.user?.id)
        .map((s) => ({ id: s.user!.id, name: s.user?.name || s.user?.email, email: s.user?.email }));
    },
    staleTime: 10 * 60 * 1000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/payouts/admin/${actionPayout?.id}/approve`),
    onSuccess: () => { invalidateAll(); toast.success("Payout approved"); closeModal(); },
    onError: () => toast.error("Failed to approve payout"),
  });

  const releaseMutation = useMutation({
    mutationFn: () => api.patch(`/payouts/admin/${actionPayout?.id}/release`, {
      payoutMethodId: releaseMethod || undefined,
      reference: releaseReference || undefined,
    }),
    onSuccess: () => { invalidateAll(); toast.success("Payout released"); closeModal(); },
    onError: () => toast.error("Failed to release payout"),
  });

  const settleMutation = useMutation({
    mutationFn: () => api.patch(`/payouts/admin/${actionPayout?.id}/settle`, {
      reference: settleReference || undefined,
      notes: settleNotes || undefined,
    }),
    onSuccess: () => { invalidateAll(); toast.success("Payout settled"); closeModal(); },
    onError: () => toast.error("Failed to settle payout"),
  });

  const failMutation = useMutation({
    mutationFn: () => api.patch(`/payouts/admin/${actionPayout?.id}/fail`, { reason: failReason }),
    onSuccess: () => { invalidateAll(); toast.success("Payout marked as failed"); closeModal(); },
    onError: () => toast.error("Failed to mark payout as failed"),
  });

  const closeModal = () => {
    setActionPayout(null);
    setActionType(null);
    setFailReason("");
    setReleaseMethod("");
    setReleaseReference("");
    setSettleReference("");
    setSettleNotes("");
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusParam) params.set("status", statusParam);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (supplierFilter) params.set("supplierId", supplierFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const qs = params.toString();
      const response = await api.get(`/payouts/admin/export${qs ? `?${qs}` : ""}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "payouts-export.csv";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Failed to export");
    }
  };

  const payoutsRaw = useMemo<Payout[]>(() => (data?.data?.payouts || data?.payouts || []) as Payout[], [data]);
  const pagination = data?.data?.pagination || data?.pagination;
  const statusCounts = useMemo(() => data?.data?.statusCounts || data?.statusCounts || {}, [data]);
  const summary = data?.data?.summary || data?.summary;
  // Finance v2: batch withdrawal requests that haven't been paid out yet —
  // they only become ledger rows here once an admin marks the request sent.
  const inFlight = data?.data?.inFlight || null;

  const goToRequestsTab = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "requests");
    setSearchParams(next, { replace: true });
  };

  const statusTabs = useMemo(() => {
    const total = STATUS_ORDER.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
    const all: Array<{ key: string; label: string; count?: number }> = [{ key: "ALL", label: "All", count: total }];
    for (const s of STATUS_ORDER) {
      all.push({ key: s, label: STATUS_LABEL[s], count: statusCounts[s] || 0 });
    }
    return all;
  }, [statusCounts]);

  const columns: Column<Payout>[] = [
    {
      key: "supplier",
      header: "Supplier",
      render: (r) => {
        const name = r.supplier?.name || "—";
        const initials = name !== "—" ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "—";
        const photoUrl = r.supplier?.photoURL || r.supplier?.user?.photoURL;
        return (
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-[11px] font-semibold text-text-secondary">
              <span className={photoUrl ? "opacity-0" : ""}>{initials}</span>
              {photoUrl && (
                <OptimizedImage
                  src={photoUrl}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-cover"
                  width={32}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text-primary">{name}</div>
              {r.supplier?.email && <div className="truncate text-[11px] text-text-tertiary">{r.supplier.email}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: "bookingId",
      header: "Booking #",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Hash className="h-3 w-3 shrink-0 text-text-tertiary" />
          <span className="font-mono text-xs text-text-secondary">{r.booking?.bookingNumber || (r.bookingId ? truncateId(r.bookingId) : "—")}</span>
        </div>
      ),
    },
    {
      key: "tour",
      header: "Tour",
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span className="truncate text-sm text-text-primary">{r.booking?.tour?.title || r.tour?.title || "—"}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (r) => <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(r.amount)}</span>,
    },
    {
      key: "commission",
      header: "Commission",
      className: "text-right",
      render: (r) => <span className="text-sm text-text-secondary tabular-nums">{formatCurrency(r.commissionAmount ?? r.commission)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status || "UNKNOWN"} />,
    },
    {
      key: "payoutMethod",
      header: "Method",
      render: (r) => {
        const m = r.payoutMethod;
        if (!m?.type) return <span className="text-sm text-text-tertiary">—</span>;
        const isBank = m.type.toLowerCase().includes("bank");
        const Icon = isBank ? Building2 : Wallet;
        return (
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 shrink-0 text-text-tertiary" />
            <span className="truncate text-xs text-text-secondary">{m.type.replace(/_/g, " ")}</span>
          </div>
        );
      },
    },
    {
      key: "createdAt",
      header: "Date",
      render: (r) => {
        const d = r.createdAt ? new Date(r.createdAt) : null;
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <span className="text-xs text-text-secondary">{d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-text-tertiary hover:text-text-primary sm:h-8 sm:w-8" onClick={(e) => { e.stopPropagation(); openDetail(r); }} title="View details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const openDetail = (r: Payout) => {
    setDetailPayout(r);
    setDetailPayoutPhoto(r.supplier?.photoURL || r.supplier?.user?.photoURL);
  };

  useEffect(() => {
    const payoutId = searchParams.get("payoutId");
    if (!payoutId || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    setHighlightedPayoutId(payoutId);
  }, [searchParams]);

  useEffect(() => {
    if (!highlightedPayoutId || payoutsRaw.length === 0) return;
    const found = payoutsRaw.find((p) => p.id === highlightedPayoutId);
    if (found) {
      setTimeout(() => {
        tableRef.current?.querySelector(`[data-row-id="${highlightedPayoutId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      if (found.status === "PENDING" && can("payouts.approve")) {
        setTimeout(() => { setActionPayout(found); setActionType("approve"); }, 200);
      }
      setTimeout(() => setHighlightedPayoutId(null), 3000);
    }
  }, [payoutsRaw, highlightedPayoutId, can]);

  const avgCommission = useMemo(() => {
    if (summary?.totalAmount && Number(summary.totalAmount) > 0) {
      return ((Number(summary.totalCommission ?? 0) / Number(summary.totalAmount)) * 100).toFixed(1) + "%";
    }
    return "—";
  }, [summary]);

  const handleStatusTab = useCallback((key: string) => {
    setStatusTab(key);
    setPage(1);
    onStatusChange?.(key === "ALL" ? undefined : key);
  }, [onStatusChange]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Payout Amount" value={formatCurrency(summary.totalAmount ?? 0)} icon={<DollarSign className="h-5 w-5" />} accent="blue" />
          <StatCard label="Total Commission" value={formatCurrency(summary.totalCommission ?? 0)} icon={<Receipt className="h-5 w-5" />} accent="emerald" />
          <StatCard label="Total Payouts" value={formatNumber(pagination?.totalCount ?? payoutsRaw.length)} icon={<Receipt className="h-5 w-5" />} accent="amber" />
          <StatCard label="Avg Commission" value={avgCommission} icon={<Percent className="h-5 w-5" />} accent="red" />
        </div>
      )}

      {/* In-flight money — batch requests not yet in the ledger below */}
      {inFlight && ((inFlight.awaitingApproval?.count ?? 0) > 0 || (inFlight.approvedAwaitingTransfer?.count ?? 0) > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={goToRequestsTab}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-l-4 bg-surface-base p-4 text-left transition-colors hover:bg-surface-muted/60",
              (inFlight.awaitingApproval?.count ?? 0) > 0 ? "border-l-status-pending" : "border-l-border"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-pending/10 text-status-pending">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Awaiting approval</p>
                <p className="text-xs text-text-secondary tabular-nums">
                  {formatNumber(inFlight.awaitingApproval?.count ?? 0)} request(s) · {formatCurrency(inFlight.awaitingApproval?.total ?? 0)}
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>
          <button
            onClick={goToRequestsTab}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-l-4 bg-surface-base p-4 text-left transition-colors hover:bg-surface-muted/60",
              (inFlight.approvedAwaitingTransfer?.count ?? 0) > 0 ? "border-l-status-processing" : "border-l-border"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-processing/10 text-status-processing">
                <Send className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Approved · awaiting transfer</p>
                <p className="text-xs text-text-secondary tabular-nums">
                  {formatNumber(inFlight.approvedAwaitingTransfer?.count ?? 0)} request(s) · {formatCurrency(inFlight.approvedAwaitingTransfer?.total ?? 0)}
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>
        </div>
      )}

      {/* Sync explanation */}
      <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2.5 text-xs text-text-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        This register lists money actually sent to suppliers, one ledger row per booking. Supplier withdrawal requests appear here only after they are approved and marked as sent on the Payout Requests tab; everything still in flight is shown above.
      </p>

      <Card>
        <CardHeader className="border-b border-border px-5 pb-4 pt-5">
          <PayoutStatusTabs tabs={statusTabs} active={statusTab} onChange={handleStatusTab} className="-mx-5 -mt-5 mb-4 px-5 pt-4" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search supplier, email, booking #..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={supplierFilter || "all"} onValueChange={(v) => { setSupplierFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All suppliers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-full sm:w-[150px]" />
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-full sm:w-[150px]" />
              {can("payouts.export") && (
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 border-border text-text-secondary hover:text-text-primary">
                  <Download className="h-4 w-4" /> Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4">
          <div ref={tableRef}>
            <DataTable
              columns={columns}
              data={payoutsRaw}
              loading={isLoading}
              error={isError ? "Failed to load payouts" : null}
              emptyMessage={debouncedSearch || statusParam || supplierFilter || startDate || endDate ? "No payouts match the current filters" : "No payouts yet. Completed withdrawal requests appear here once marked as sent"}
              pagination={pagination ? { page: pagination.currentPage || page, totalPages: pagination.totalPages || 1, totalCount: pagination.totalCount || 0, onPageChange: setPage } : undefined}
              onRetry={() => refetch()}
              keyExtractor={(r) => r.id}
              highlightedKey={highlightedPayoutId || undefined}
              onRowClick={openDetail}
            />
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        open={actionType === "approve" && !!actionPayout}
        title="Approve Payout"
        description={`Approve ${formatCurrency(actionPayout?.amount)} to ${actionPayout?.supplier?.name || "supplier"}? This moves it to the release stage.`}
        confirmLabel="Approve"
        icon="publish"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={actionType === "release" && !!actionPayout}
        title="Release Payout"
        description="Release funds to the supplier. Payment is marked as in transit until settled."
        confirmLabel="Release"
        icon="warning"
        confirmDisabled={!releaseMethod}
        loading={releaseMutation.isPending}
        onConfirm={() => releaseMutation.mutate()}
        onCancel={closeModal}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Payout Method</Label>
            {(() => {
              const methods = (methodsData?.data?.methods || methodsData?.methods || []) as PayoutMethod[];
              return methods.length ? (
                <Select value={releaseMethod} onValueChange={setReleaseMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.type} {m.details ? `- ${m.details}` : ""} {m.isDefault ? "(Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-status-rejected">Supplier has no verified payout method</p>
              );
            })()}
          </div>
          <div className="space-y-2">
            <Label htmlFor="releaseReference">Reference (optional)</Label>
            <Input id="releaseReference" value={releaseReference} onChange={(e) => setReleaseReference(e.target.value)} placeholder="Transaction reference..." />
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={actionType === "settle" && !!actionPayout}
        title="Settle Payout"
        description={`Confirm funds received for ${formatCurrency(actionPayout?.amount)} to ${actionPayout?.supplier?.name || "supplier"}. This marks the payout as paid.`}
        confirmLabel="Settle"
        icon="publish"
        loading={settleMutation.isPending}
        onConfirm={() => settleMutation.mutate()}
        onCancel={closeModal}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settleReference">Reference (optional)</Label>
            <Input id="settleReference" value={settleReference} onChange={(e) => setSettleReference(e.target.value)} placeholder="Payment provider reference..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settleNotes">Notes (optional)</Label>
            <Textarea id="settleNotes" value={settleNotes} onChange={(e) => setSettleNotes(e.target.value)} placeholder="Admin notes..." rows={2} />
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={actionType === "fail" && !!actionPayout}
        title="Mark Payout as Failed"
        description={`Mark ${formatCurrency(actionPayout?.amount)} to ${actionPayout?.supplier?.name || "supplier"} as failed. A reason is required.`}
        confirmLabel="Mark as Failed"
        confirmVariant="destructive"
        confirmDisabled={failReason.length < 10}
        icon="danger"
        loading={failMutation.isPending}
        onConfirm={() => failMutation.mutate()}
        onCancel={closeModal}
      >
        <div className="space-y-2">
          <Label htmlFor="failReason">Reason (required, min 10 chars)</Label>
          <Textarea id="failReason" value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="Enter the reason for failure..." rows={3} />
          {failReason.length > 0 && failReason.length < 10 && (
            <p className="text-xs text-status-rejected">Minimum 10 characters</p>
          )}
        </div>
      </ConfirmModal>

      {detailPayout && (
        <PayoutDetailPanel
          payout={detailPayout}
          supplierPhotoUrl={detailPayoutPhoto}
          onClose={() => { setDetailPayout(null); setDetailPayoutPhoto(undefined); }}
          onApprove={(p) => { setActionPayout(p); setActionType("approve"); }}
          onRelease={(p) => { setActionPayout(p); setActionType("release"); }}
          onSettle={(p) => { setActionPayout(p); setActionType("settle"); }}
          onFail={(p) => { setActionPayout(p); setActionType("fail"); }}
        />
      )}
    </div>
  );
}