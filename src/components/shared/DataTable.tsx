import { ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pagination } from "./Pagination";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export type DataTableSize = "comfortable" | "compact";

interface Pagination {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: Pagination;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRetry?: () => void;
  keyExtractor: (row: T) => string;
  expandedRow?: string | null;
  renderExpanded?: (row: T) => React.ReactNode;
  highlightedKey?: string;
  size?: DataTableSize;
}

const alignClass: Record<NonNullable<Column<never>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  emptyMessage = "No items found",
  onRowClick,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onRetry,
  keyExtractor,
  expandedRow,
  renderExpanded,
  highlightedKey,
  size = "comfortable",
}: DataTableProps<T>) {
  const rowPad = size === "compact" ? "px-4 py-2" : "px-5 py-3";
  const rowMinH = size === "compact" ? "min-h-[40px]" : "min-h-[48px]";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-base py-12 text-text-secondary" aria-live="polite">
        <AlertCircle className="mb-2 h-8 w-8 text-status-rejected" />
        <p className="text-sm">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface-base shadow-soft" aria-live="polite" aria-label="Loading data">
        <div className="flex border-b border-border/60 bg-surface-muted/60">
          {columns.map((col) => (
            <div key={col.key} className={cn("flex-1 px-5 py-3", col.className)}>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("flex items-center border-b border-border/50", rowMinH)}>
            {columns.map((col) => (
              <div key={col.key} className={cn("flex-1 px-5", col.className)}>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-base py-12 text-text-secondary" aria-live="polite">
        <Inbox className="mb-2 h-8 w-8" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-base shadow-soft">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-border/60 bg-surface-muted/80 backdrop-blur-md">
              {columns.map((col) => {
                const active = sortBy === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap px-5 py-3 text-xs font-semibold text-text-secondary leading-tight",
                      alignClass[col.align ?? "left"],
                      col.sortable && "cursor-pointer select-none hover:text-text-primary",
                      col.className,
                    )}
                    onClick={() => {
                      if (col.sortable && onSort) onSort(col.key);
                    }}
                    aria-label={typeof col.header === "string"
                      ? (col.sortable
                          ? `${col.header}, sortable. Current sort: ${active ? sortOrder : "none"}`
                          : col.header)
                      : col.key}
                    tabIndex={col.sortable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (col.sortable && onSort && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onSort(col.key);
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable &&
                        (active ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.flatMap((row) => {
              const isExpanded = expandedRow === keyExtractor(row);
              const rowEl = (
                <tr
                  key={keyExtractor(row)}
                  data-row-id={keyExtractor(row)}
                  className={cn(
                    "border-b border-border/50 transition-colors duration-100",
                    rowMinH,
                    onRowClick && "cursor-pointer",
                    onRowClick && "hover:bg-surface-muted/40",
                    isExpanded && "bg-surface-muted/60",
                    highlightedKey === keyExtractor(row) && "bg-accent/40 ring-1 ring-primary/20",
                  )}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn(rowPad, "align-middle", alignClass[col.align ?? "left"], col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
              if (!isExpanded || !renderExpanded) return [rowEl];
              return [
                rowEl,
                <tr key={`exp-${keyExtractor(row)}`}>
                  <td colSpan={columns.length} className="border-b border-border/50 bg-surface-muted/30 p-0">
                    {renderExpanded(row)}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="border-t border-border/60 px-4 py-3">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            pageSize={pagination.pageSize}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}