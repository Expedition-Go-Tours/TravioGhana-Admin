import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Map, DollarSign, Star, Eye, TrendingUp, X, ArrowLeft } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import { CellThumb, CellTitle, MoneyCell, DateCell, StatusCell } from "@/components/shared/table-cells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/axios";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Tour {
  id: string;
  title?: string;
  status?: string;
  coverPhoto?: string;
  supplier?: { name?: string };
  totalBookings?: number;
  totalRevenue?: number;
  averageRating?: number;
  reviewCount?: number;
  viewCount?: number;
  createdAt?: string;
  schedulesAndPricing?: { currency?: string } | string;
  _count?: { bookings?: number };
}

const statusOptions = ["all", "Draft", "Active", "Paused", "Archived"];

export default function TourPerformancePage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("totalRevenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const limit = 20;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (status && status !== "all") queryParams.set("status", status);
  if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "tours", { page, limit, status, sortBy, sortOrder, search: searchQuery.trim() }],
    queryFn: () => api.get(`/admin/analytics/tour-performance?${queryParams.toString()}`).then((r) => r.data),
  });

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  const rawTours = data?.data?.tours || data?.tours || [];

  // Server-side search (title / supplier name) + server-side sort already
  // applied by /admin/analytics/tour-performance?search=...
  const tours: Tour[] = rawTours;
  const pagination = data?.pagination || data?.data?.pagination;
  const totalCount = pagination?.totalCount || 0;

  const aggregate = tours.reduce(
    (acc: { revenue: number; bookings: number; views: number }, t: Tour) => ({
      revenue: acc.revenue + Number(t.totalRevenue || 0),
      bookings: acc.bookings + Number(t._count?.bookings ?? t.totalBookings ?? 0),
      views: acc.views + Number(t.viewCount || 0),
    }),
    { revenue: 0, bookings: 0, views: 0 },
  );

  const columns: Column<Tour>[] = [
    {
      key: "title",
      header: "Tour",
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <CellThumb src={r.coverPhoto} alt="" fallbackIcon={<Map className="h-3.5 w-3.5" />} />
          <CellTitle title={r.title || "—"} subtitle={r.supplier?.name || "No supplier"} />
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusCell status={r.status || "UNKNOWN"} /> },
    {
      key: "totalBookings",
      header: "Bookings",
      sortable: true,
      align: "right",
      render: (r) => <span className="font-semibold text-text-primary tnum">{formatNumber(r._count?.bookings ?? r.totalBookings)}</span>,
    },
    {
      key: "totalRevenue",
      header: "Revenue",
      sortable: true,
      align: "right",
      render: (r) => {
        const sp = typeof r.schedulesAndPricing === "string" ? JSON.parse(r.schedulesAndPricing || "{}") : (r.schedulesAndPricing || {});
        return <MoneyCell value={r.totalRevenue} currency={sp.currency} />;
      },
    },
    {
      key: "conversion",
      header: "Conv %",
      align: "right",
      render: (r) => {
        const views = Number(r.viewCount || 0);
        const bookings = Number(r._count?.bookings ?? r.totalBookings ?? 0);
        const rate = views > 0 ? (bookings / views) * 100 : 0;
        return <span className="text-xs font-medium text-text-secondary tnum">{rate.toFixed(1)}%</span>;
      },
    },
    {
      key: "averageRating",
      header: "Rating",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-text-primary tnum">
          {Number(r.averageRating ?? 0).toFixed(1)} <Star className="h-3 w-3 fill-status-pending text-status-pending-text" />
        </span>
      ),
    },
    {
      key: "reviewCount",
      header: "Reviews",
      sortable: true,
      align: "right",
      render: (r) => <span className="text-text-secondary tnum">{formatNumber(r.reviewCount)}</span>,
    },
    {
      key: "viewCount",
      header: "Views",
      sortable: true,
      align: "right",
      render: (r) => <span className="text-text-secondary tnum">{formatNumber(r.viewCount)}</span>,
    },
    { key: "createdAt", header: "Created", render: (r) => <DateCell value={r.createdAt} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-base text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[26px] font-light leading-8 tracking-[-0.26px] text-text-primary">Tour Performance</h1>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-text-tertiary">{totalCount} tour{totalCount > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Summary Cards */}
      <div  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><KpiCard
          label="Total Tours"
          value={isLoading ? "..." : formatNumber(totalCount)}
          icon={<Map className="h-5 w-5" />}
          accent="emerald"
        /></div>
        <div><KpiCard
          label="Total Revenue"
          value={isLoading ? "..." : formatCurrency(aggregate.revenue)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="blue"
        /></div>
        <div><KpiCard
          label="Total Bookings"
          value={isLoading ? "..." : formatNumber(aggregate.bookings)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="amber"
        /></div>
        <div><KpiCard
          label="Total Views"
          value={isLoading ? "..." : formatNumber(aggregate.views)}
          icon={<Eye className="h-5 w-5" />}
          accent="emerald"
        /></div>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4 pl-5 pr-5 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search tours..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={status || "all"} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(status !== "all" || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setSearchQuery(""); setPage(1); }} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4">
          <DataTable
            columns={columns}
            data={tours}
            loading={isLoading}
            error={isError ? "Failed to load tours" : null}
            emptyMessage="No tours found matching your filters"
            onRowClick={(row) => navigate(`/admin/tours/${row.id}`)}
            pagination={pagination ? { page: pagination.page || page, totalPages: pagination.totalPages || 1, totalCount: pagination.totalCount || 0, onPageChange: setPage } : undefined}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: "emerald" | "blue" | "amber" }) {
  const tone = {
    emerald: "bg-primary/10 text-primary",
    blue: "bg-status-approved/10 text-status-approved-text",
    amber: "bg-status-pending/10 text-status-pending-text",
  }[accent];
  return (
    <div className="rounded-xl border border-border bg-surface-base p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-medium leading-snug text-text-tertiary">{label}</p>
          <p className="tnum text-[26px] font-light leading-tight tracking-[-0.26px] text-text-primary">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}