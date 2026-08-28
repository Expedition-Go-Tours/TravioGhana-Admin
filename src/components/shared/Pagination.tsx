import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

function getPageItems(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);
  return items;
}

const pageBtn =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors ";

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to = pageSize ? Math.min(page * pageSize, totalCount) : undefined;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="order-2 text-xs text-text-tertiary sm:order-1">
        {from != null && to != null ? (
          <>
            Showing <span className="font-semibold text-text-secondary">{from}–{to}</span> of{" "}
            <span className="font-semibold text-text-secondary">{totalCount}</span>
          </>
        ) : (
          <>
            Page <span className="font-semibold text-text-secondary">{page}</span> of{" "}
            <span className="font-semibold text-text-secondary">{totalPages}</span>
            {" · "}
            <span className="font-semibold text-text-secondary">{totalCount}</span> total
          </>
        )}
      </p>

      <div className="order-1 flex flex-wrap items-center justify-end gap-1.5 sm:order-2">
        {onPageSizeChange && (
          <Select value={String(pageSize ?? 10)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[76px] gap-2 rounded-md px-2.5 text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(pageBtn, "gap-1 text-text-secondary hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40")}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {getPageItems(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="inline-flex h-8 w-6 items-center justify-center text-text-tertiary">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                pageBtn,
                item === page
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-secondary hover:bg-surface-muted",
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(pageBtn, "gap-1 text-text-secondary hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40")}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}