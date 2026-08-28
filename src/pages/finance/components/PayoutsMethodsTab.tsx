import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Wallet, AlertCircle, ShieldCheck, Search, Building2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { PayoutMethodCard, type PayoutMethodData } from "@/components/payouts/PayoutMethodCard";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import api from "@/lib/axios";
import { formatDate } from "@/lib/utils";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface PayoutMethodSupplier {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  user?: { id?: string; name?: string; email?: string; photoURL?: string };
  status?: string;
  supplierProfile?: { status?: string };
  methodsCount?: number;
  defaultMethod?: string;
  payoutMethods?: PayoutMethodData[];
}

interface CoverageSummary {
  totalSuppliers?: number;
  withMethod?: number;
  needSetup?: number;
  unverified?: number;
  hasDefault?: number;
  typeMix?: {
    BANK_TRANSFER?: { total?: number; verified?: number };
    PAYPAL?: { total?: number; verified?: number };
  };
}

const filterOptions = [
  { value: "all", label: "All" },
  { value: "true", label: "Only with methods" },
  { value: "false", label: "Only without methods" },
];

export function PayoutsMethodsTab() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [hasMethod, setHasMethod] = useState("all");
  const [viewSupplierId, setViewSupplierId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payout-methods", { page, limit, hasMethod }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (hasMethod && hasMethod !== "all") params.set("hasMethod", hasMethod);
      return api.get(`/payout-methods/admin?${params.toString()}`).then((r) => r.data);
    },
  });

  const { data: coverage } = useQuery<CoverageSummary>({
    queryKey: ["admin", "payout-methods", "summary"],
    queryFn: () => api.get("/payout-methods/admin/summary").then((r) => r.data?.data || r.data),
  });

  const { data: methodsData, isLoading: methodsLoading } = useQuery({
    queryKey: ["admin", "payout-methods", "supplier", viewSupplierId],
    queryFn: () => api.get(`/payout-methods/admin/suppliers/${viewSupplierId}`).then((r) => r.data),
    enabled: !!viewSupplierId && can("payout-methods.view"),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ methodId, verified }: { methodId: string; verified: boolean }) =>
      api.patch(`/payout-methods/admin/${methodId}/verify`, { verified }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payout-methods", "supplier", viewSupplierId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payout-methods", "summary"] });
      toast.success("Payout method verification updated");
    },
    onError: () => toast.error("Failed to update verification"),
  });

  const suppliers: PayoutMethodSupplier[] = useMemo(() => data?.data?.suppliers || data?.suppliers || [], [data]);
  const pagination = data?.data?.pagination || data?.pagination;
  const selectedSupplier = suppliers.find((s) => s.id === viewSupplierId);

  const searchLower = search.toLowerCase();
  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    return suppliers.filter(
      (s) =>
        (s.name || s.user?.name || "").toLowerCase().includes(searchLower) ||
        (s.email || s.user?.email || "").toLowerCase().includes(searchLower),
    );
  }, [suppliers, search, searchLower]);

  const mix = coverage?.typeMix || {};
  const mixTotal = (mix.BANK_TRANSFER?.total || 0) + (mix.PAYPAL?.total || 0);

  const columns: Column<PayoutMethodSupplier>[] = [
    {
      key: "name",
      header: "Supplier Name",
      render: (r) => {
        const name = r.name || r.user?.name || "—";
        const initial = name.charAt(0).toUpperCase();
        const photoUrl = r.photoURL || r.user?.photoURL;
        return (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white">
              <span>{initial}</span>
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
            <span className="truncate">{name}</span>
          </div>
        );
      },
    },
    { key: "email", header: "Email", render: (r) => r.email || r.user?.email || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.supplierProfile?.status || r.status || "UNKNOWN"} /> },
    { key: "methodsCount", header: "Methods Count", align: "right", render: (r) => <span className="tabular-nums">{String(r.payoutMethods?.length ?? r.methodsCount ?? 0)}</span> },
    { key: "defaultMethod", header: "Default Method", render: (r) => r.payoutMethods?.find((m) => m.isDefault)?.type?.replace(/_/g, " ") || r.defaultMethod || <span className="italic text-text-tertiary">Not set</span> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setViewSupplierId(r.id); }} className="gap-1">
          <Building2 className="h-3 w-3" /> View
        </Button>
      ),
    },
  ];

  const coverMeta = coverage;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Supplier Coverage"
          value={isLoading ? "..." : formatCoverage(coverMeta?.withMethod, coverMeta?.totalSuppliers)}
          icon={<Users className="h-5 w-5" />}
          accent="emerald"
          subtitle={isLoading ? undefined : `${formatNumber(coverMeta?.totalSuppliers)} total suppliers`}
        />
        <StatCard
          label="Need Setup"
          value={isLoading ? "..." : formatNumber(coverMeta?.needSetup)}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Unverified"
          value={isLoading ? "..." : formatNumber(coverMeta?.unverified)}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="red"
        />
        <StatCard
          label="Methods on File"
          value={isLoading ? "..." : formatNumber(mixTotal)}
          icon={<Wallet className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      {coverage && !isLoading && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-tertiary">Type mix:</span>
          {mix.BANK_TRANSFER && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved/10 px-3 py-1 text-xs font-medium text-status-approved">
              <Building2 className="h-3 w-3" />
              Bank {mix.BANK_TRANSFER.total}{mix.BANK_TRANSFER.verified ? ` · ${mix.BANK_TRANSFER.verified} verified` : ""}
            </span>
          )}
          {mix.PAYPAL && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-flagged/10 px-3 py-1 text-xs font-medium text-status-flagged">
              <Wallet className="h-3 w-3" />
              PayPal {mix.PAYPAL.total}{mix.PAYPAL.verified ? ` · ${mix.PAYPAL.verified} verified` : ""}
            </span>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              <Input
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={hasMethod} onValueChange={(v) => { setHasMethod(v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                {filterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-text-tertiary tabular-nums">
              {filteredSuppliers.length} of {pagination?.totalCount ?? suppliers.length} suppliers
            </span>
          </div>
          <DataTable
            columns={columns}
            data={filteredSuppliers}
            loading={isLoading}
            error={isError ? "Failed to load payout methods" : null}
            emptyMessage={search ? "No suppliers match your search" : "No suppliers found"}
            pagination={!search && pagination ? { page: pagination.currentPage || page, totalPages: pagination.totalPages || 1, totalCount: pagination.totalCount || 0, onPageChange: setPage } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
            onRowClick={(r) => setViewSupplierId(r.id)}
          />
        </CardContent>
      </Card>

      <Dialog open={!!viewSupplierId} onOpenChange={(v) => { if (!v) setViewSupplierId(null); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-y-auto max-h-[90vh] scrollbar-none border-0">
          <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 pt-6 pb-8">
            <div className="flex items-center gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-base font-bold text-white shadow-inner">
                <span>{(selectedSupplier?.name || selectedSupplier?.user?.name)?.charAt(0)?.toUpperCase() || "?"}</span>
                {(selectedSupplier?.photoURL || selectedSupplier?.user?.photoURL) && (
                  <OptimizedImage
                    src={selectedSupplier?.photoURL || selectedSupplier?.user?.photoURL || ""}
                    alt={selectedSupplier?.name || ""}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover"
                    width={48}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-white">{selectedSupplier?.name || selectedSupplier?.user?.name || "Supplier"}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-green-100">
                  {selectedSupplier?.email || selectedSupplier?.user?.email || ""}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {methodsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
              </div>
            ) : !methodsData?.data?.methods?.length ? (
              <SectionEmpty message="No payout methods set up yet" />
            ) : (
              <div className="space-y-4">
                {(methodsData.data.methods as PayoutMethodData[]).map((method) => (
                  <PayoutMethodCard
                    key={method.id}
                    method={method}
                    className={can("payout-methods.verify") ? "" : "!border-b" }
                    onVerifyToggle={can("payout-methods.verify") ? (methodId, verified) => verifyMutation.mutate({ methodId, verified }) : undefined}
                    verifying={verifyMutation.isPending}
                  />
                ))}
                {methodsData.data.methods[0]?.createdAt && (
                  <p className="text-xs text-text-tertiary">Added {formatDate(methodsData.data.methods[0].createdAt)}</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatCoverage(withMethod?: number, total?: number): string {
  if (withMethod == null || !total) return "—";
  return `${Math.round((withMethod / total) * 100)}%`;
}

function formatNumber(n?: number): string {
  if (n == null) return "—";
  return n.toLocaleString();
}