import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Users } from "lucide-react";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Supplier {
  id?: string;
  user?: { name?: string; email?: string; photoURL?: string };
  totalEarnings?: number;
  currency?: string;
  totalBookings?: number;
  averageRating?: number;
}

interface TopSuppliersProps {
  suppliers?: Supplier[];
  loading?: boolean;
}

export function TopSuppliers({ suppliers = [], loading }: TopSuppliersProps) {
  const navigate = useNavigate();

  return (
    <Card className="h-full border border-border/60 shadow-soft bg-surface-base rounded-2xl">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <Users className="h-4 w-4" />
            </span>
            Top Suppliers
          </CardTitle>
          <button
            onClick={() => navigate("/admin/suppliers")}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-secondary">No supplier data</div>
        ) : (
          <div className="space-y-1">
            {suppliers.slice(0, 5).map((supplier, idx) => (
              <div
                key={supplier.id || idx}
                className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer"
                onClick={() => supplier.id && navigate(`/admin/suppliers/${supplier.id}`)}
              >
                <div className="relative">
                  {supplier.user?.photoURL ? (
                    <OptimizedImage src={supplier.user.photoURL} alt="" width={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary">
                      {supplier.user?.name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                  )}
                  <span className={cn(
                    "absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm",
                    idx === 0 ? "bg-emerald-600" : idx === 1 ? "bg-blue-500" : idx === 2 ? "bg-violet-500" : "bg-text-tertiary"
                  )}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{supplier.user?.name || "Unknown"}</p>
                  <p className="text-xs text-text-tertiary">{formatNumber(supplier.totalBookings)} bookings</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(supplier.totalEarnings, supplier.currency)}</p>
                  <div className="flex items-center gap-1 justify-end">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-text-tertiary">{supplier.averageRating != null ? Number(supplier.averageRating).toFixed(1) : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}