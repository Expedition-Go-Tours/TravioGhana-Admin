import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  FileText,
  UserCheck,
  UserX,
  Ban,
  CalendarClock,
  CalendarX,
  Bus,
  Briefcase,
  IdCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageInsight } from "@/components/shared/PageInsight";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/shared/SectionError";
import { formatNumber } from "@/lib/utils";
import api from "@/lib/axios";

interface QcDashboardData {
  newRegistrationsThisWeek: number;
  pendingVerification: number;
  pending: number;
  underReview: number;
  documentsAwaitingReview: number;
  documentStatuses: Record<string, number>;
  approvedSuppliers: number;
  rejected: number;
  suspended: number;
  expiredSuppliers: number;
  expiredDocuments: number;
  expiringSoon: { within60: number; within30: number; within7: number };
  guidesAwaitingVerification: number;
  businessesAwaitingVerification: number;
  vehiclesAwaitingVerification: number;
}

export default function SupplierQcDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "suppliers", "qc-dashboard"],
    queryFn: () => api.get("/suppliers/admin/qc-dashboard").then((r) => r.data?.data as QcDashboardData),
  });

  if (isError) return <SectionError message="Failed to load quality-control data" onRetry={() => refetch()} />;

  const d = data as QcDashboardData | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control"
        subtitle="Supplier verification pipeline — documents, licences, vehicles and guides that need a decision"
      />

      <PageInsight icon={<ShieldCheck className="h-4 w-4" />} title="Trust is the product">
        Every supplier, guide and vehicle must pass document review before it can sell. This screen surfaces everything waiting on your team — new registrations, expired licences approaching their deadline, and the individual documents that still need approval. Clear the queues here and expired-licence suspensions stop themselves before they hurt revenue.
      </PageInsight>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Applications</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="New This Week" value={isLoading ? "..." : formatNumber(d?.newRegistrationsThisWeek)} icon={<Users className="h-5 w-5" />} accent="emerald" loading={isLoading} subtitle="Fresh registrations" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Pending Verification" value={isLoading ? "..." : formatNumber(d?.pendingVerification)} icon={<IdCard className="h-5 w-5" />} accent="amber" loading={isLoading} subtitle={`${formatNumber(d?.underReview)} under review`} onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Businesses Awaiting" value={isLoading ? "..." : formatNumber(d?.businessesAwaitingVerification)} icon={<Briefcase className="h-5 w-5" />} accent="blue" loading={isLoading} subtitle="Companies & operators" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Approved" value={isLoading ? "..." : formatNumber(d?.approvedSuppliers)} icon={<UserCheck className="h-5 w-5" />} accent="emerald" loading={isLoading} subtitle="Verified suppliers" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Rejected" value={isLoading ? "..." : formatNumber(d?.rejected)} icon={<UserX className="h-5 w-5" />} accent="red" loading={isLoading} subtitle="Applications declined" onClick={() => navigate("/admin/suppliers")} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Documents</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Awaiting Review" value={isLoading ? "..." : formatNumber(d?.documentsAwaitingReview)} icon={<FileText className="h-5 w-5" />} accent="amber" loading={isLoading} subtitle="Individual documents" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Suspended" value={isLoading ? "..." : formatNumber(d?.suspended)} icon={<Ban className="h-5 w-5" />} accent="red" loading={isLoading} subtitle="Suppliers taken offline" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Expired Suppliers" value={isLoading ? "..." : formatNumber(d?.expiredSuppliers)} icon={<CalendarX className="h-5 w-5" />} accent="red" loading={isLoading} subtitle="On hold for renewal" onClick={() => navigate("/admin/suppliers")} />
          <StatCard label="Expired Documents" value={isLoading ? "..." : formatNumber(d?.expiredDocuments)} icon={<CalendarX className="h-5 w-5" />} accent="red" loading={isLoading} subtitle="Needs a fresh copy" onClick={() => navigate("/admin/suppliers")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <CalendarClock className="h-4 w-4 text-amber-500" /> Expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Within 60 days", value: d?.expiringSoon?.within60 ?? 0 },
                  { label: "Within 30 days", value: d?.expiringSoon?.within30 ?? 0 },
                  { label: "Within 7 days", value: d?.expiringSoon?.within7 ?? 0 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg border border-border bg-surface-base px-4 py-3">
                    <span className="text-sm text-text-secondary">{row.label}</span>
                    <span className="text-sm font-semibold text-text-primary tabular-nums">{formatNumber(row.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Bus className="h-4 w-4 text-primary" /> Fleet & teams
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Guides awaiting verification", icon: <IdCard className="h-4 w-4 text-text-tertiary" />, value: d?.guidesAwaitingVerification ?? 0 },
                  { label: "Vehicles awaiting verification", icon: <Bus className="h-4 w-4 text-text-tertiary" />, value: d?.vehiclesAwaitingVerification ?? 0 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg border border-border bg-surface-base px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-text-secondary">{row.icon}{row.label}</span>
                    <span className="text-sm font-semibold text-text-primary tabular-nums">{formatNumber(row.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-base px-5 py-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Review the full supplier queue</p>
          <p className="text-xs text-text-tertiary">Filter by type and status, open a supplier, and approve each document</p>
        </div>
        <Button onClick={() => navigate("/admin/suppliers")}>Open suppliers</Button>
      </div>
    </div>
  );
}