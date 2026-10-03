import { useId } from "react";
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
  /**
   * Money/number column. Applies `tabular-nums` so digits align vertically
   * down the column, and right-aligns unless an explicit `align` is given.
   * Primer: "Right-align numeric values and use the tabular-num font variant
   * when possible."
   */
  numeric?: boolean;
  /**
   * Render this cell as the row's header (`<th scope="row">`) so a screen-reader
   * user navigating by row hears the subject before the amounts, e.g.
   * "Expedition-Go Tours LTD, gross $811.91, net $690.12".
   */
  rowHeader?: boolean;
  /** Hide this column below the given breakpoint to keep dense tables readable. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

export type DataTableSize = "comfortable" | "compact" | "dense";

interface Pagination {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export interface RowSelection<T> {
  /** Currently selected row keys. */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Return false to make a row's checkbox unavailable (e.g. wrong status). */
  isSelectable?: (row: T) => boolean;
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
  /**
   * Accessible name for the table. Rendered as a visually hidden `<caption>`
   * so the table is announced with its purpose rather than just "table".
   */
  caption?: string;
  /**
   * Cap the table body height and scroll it internally. This is also what makes
   * `sticky` headers actually work: a sticky element positions against its
   * nearest scrolling ancestor, and the horizontal `overflow-x-auto` wrapper
   * below is itself a scroll container, so without a height cap the header
   * sticks to a container that never scrolls vertically and the effect is inert.
   */
  maxHeight?: string;
  /** Toolbar rendered above the header row. Carbon: toolbar height matches row height. */
  toolbar?: React.ReactNode;
  /** Batch-action bar, shown only while rows are selected. Disables per-row actions. */
  batchBar?: React.ReactNode;
  selection?: RowSelection<T>;
  /** Per-row busy state — for pessimistic money mutations (research: no optimistic approve). */
  rowPending?: (row: T) => boolean;
  /** Totals / summary row pinned to the bottom of the body. */
  totals?: React.ReactNode;
  /** Label for the checkbox column, used as its accessible name. */
  selectionLabel?: string;
}

const alignClass: Record<NonNullable<Column<never>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

// `height`, not `min-height`. A `min-height` on a <tr> is inert -- CSS minimums
// do not apply to table-row boxes -- so the density floor silently did nothing
// and every row collapsed to its bare content height (measured: 33px skeleton
// rows against 63px loaded rows). `height` on a table-row IS honoured, and
// behaves as a floor: content taller than the value still wins.
const sizeMap: Record<DataTableSize, { rowPad: string; rowMinH: string; headPad: string; chromeH: string }> = {
  dense: { rowPad: "px-4 py-2", rowMinH: "h-[40px]", headPad: "px-4 py-2.5", chromeH: "h-10" },
  compact: { rowPad: "px-4 py-2.5", rowMinH: "h-[44px]", headPad: "px-4 py-3", chromeH: "h-11" },
  comfortable: { rowPad: "px-5 py-3", rowMinH: "h-[48px]", headPad: "px-5 py-3", chromeH: "h-12" },
};

/**
 * Controls embedded in a row. A row-level click or key handler must stand down
 * when the event originated on one of these -- the control's own behaviour is
 * what the user asked for, not "open this row".
 */
const INTERACTIVE = "button, a[href], input, select, textarea, [role=\"button\"], [role=\"link\"], [contenteditable]";

const hideBelowClass: Record<NonNullable<Column<never>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
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
  caption,
  maxHeight,
  toolbar,
  batchBar,
  selection,
  rowPending,
  totals,
  selectionLabel = "Select row",
}: DataTableProps<T>) {
  const { rowPad, rowMinH, headPad } = sizeMap[size];
  const captionId = useId();
  const hasSelection = !!selection;
  const selectedCount = selection ? data.filter((r) => selection.selected.has(keyExtractor(r))).length : 0;
  const batchActive = selectedCount > 0;

  // Cells shift by one when the checkbox column is present.
  const colCount = columns.length + (hasSelection ? 1 : 0);

  const allSelectableKeys = hasSelection
    ? data
        .filter((r) => (selection?.isSelectable ? selection.isSelectable(r) : true))
        .map(keyExtractor)
    : [];
  // Gated on `hasSelection`, not just on length: only PayoutRequestsTab passes
  // a selection, so dereferencing `selection!` here threw
  // "Cannot read properties of undefined (reading 'selected')" and blanked the
  // page for every other table in the app the moment data arrived. An
  // unchecked `!` on an optional prop is a promise the caller cannot keep.
  const allSelected =
    hasSelection && allSelectableKeys.length > 0 && allSelectableKeys.every((k) => selection!.selected.has(k));
  const someSelected = hasSelection && !allSelected && allSelectableKeys.some((k) => selection!.selected.has(k));

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) allSelectableKeys.forEach((k) => next.delete(k));
    else allSelectableKeys.forEach((k) => next.add(k));
    selection.onChange(next);
  };

  const toggleOne = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-base py-12 text-text-secondary" aria-live="polite">
        <AlertCircle className="mb-2 h-8 w-8 text-status-rejected-text" />
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
    // Rendered as a REAL <table> with the same wrapper, scroll container,
    // column set, alignment and padding as the loaded branch, and reserving the
    // same chrome -- totals row and pagination bar included.
    //
    // Measured before this change: the card grew 204px -> 412px when data
    // landed, shoving everything below it 236px down the page. Three causes,
    // all fixed here:
    //   1. rows were 33px vs 63px, because `min-h-*` is inert on <tr> (above);
    //   2. the loaded table paints a <tfoot> totals row the skeleton omitted;
    //   3. the loaded table paints a pagination bar the skeleton omitted.
    //
    // A skeleton cannot know how tall real content will be, so each text cell
    // reserves the two-line shape the real cells use rather than one stub --
    // a row is as tall as its tallest cell, so over-reserving the text columns
    // matches what actually happens. `scrollbar-gutter: stable` reserves the
    // horizontal scrollbar that only exists once real column widths are known.
    const skeletonRows = 6;
    const cellFor = (col: Column<never>, i: number) => (
      <td
        key={col.key}
        className={cn(
          rowPad,
          "align-middle",
          alignClass[col.align ?? (col.numeric ? "right" : "left")],
          col.hideBelow && hideBelowClass[col.hideBelow],
          col.numeric && "tabular-nums",
        )}
      >
        {col.numeric ? (
          <Skeleton className={cn("ml-auto h-3.5", i % 3 === 0 ? "w-10" : "w-16")} />
        ) : (
          // Two lines at the real text metrics -- 14px at leading-5 is 21px
          // each, 42px of content, which with compact's 20px padding and the
          // 1px rule lands on 63px: the same as a loaded two-line row. Stub
          // heights (h-3.5/h-3) under-reserved and left a 79px jump.
          <span className="flex flex-col">
            <Skeleton className={cn("h-[21px] rounded-sm", i % 3 === 1 ? "w-3/5" : "w-4/5")} />
            <Skeleton className={cn("h-[21px] rounded-sm", i % 3 === 1 ? "w-2/5" : "w-1/2")} />
          </span>
        )}
      </td>
    );

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface-base shadow-soft">
        {toolbar && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
            {toolbar}
          </div>
        )}
        <div
          className="overflow-auto scrollbar-thin"
          style={{
            maxHeight,
            // Reserve the horizontal scrollbar so it appearing when real column
            // widths land does not steal height from the rows.
            scrollbarGutter: "stable",
          }}
        >
          <table className="w-full text-sm" aria-busy="true">
            {caption && <caption id={captionId} className="sr-only">{caption}</caption>}
            <thead>
              <tr className={cn("border-b border-border/60 bg-surface-muted/95", headPad)}>
                {hasSelection && <th scope="col" className={cn("w-10 text-left", headPad)}><Skeleton className="h-4 w-4" /></th>}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      headPad,
                      alignClass[col.align ?? (col.numeric ? "right" : "left")],
                      col.hideBelow && hideBelowClass[col.hideBelow],
                    )}
                  >
                    <Skeleton className={cn("h-3.5", col.numeric ? "ml-auto w-16" : "w-24")} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className={cn("border-b border-border/50", rowMinH)}>
                  {hasSelection && <td className={cn(rowPad, "align-middle")}><Skeleton className="h-4 w-4" /></td>}
                  {columns.map((col, ci) => cellFor(col, ci))}
                </tr>
              ))}
            </tbody>
            {totals && (
              // Reserves the totals row's presence and height without painting
              // numbers we do not have yet.
              <tfoot className="border-t-2 border-border bg-surface-muted/95">
                <tr className={cn("border-b border-border/50", rowMinH)}>
                  {columns.map((col, ci) => cellFor(col, ci))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className={cn("flex items-center justify-between border-t border-border/60 px-4", sizeMap[size].chromeH)}>
            <Skeleton className="h-3.5 w-56" />
          </div>
        )}
      </div>
    );
  }

  if (!data || data.length === 0) {
    // Carbon: the empty state replaces the table *including* its headers, or a
    // screen reader announces an empty table.
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-base py-12 text-text-secondary">
        <Inbox className="mb-2 h-8 w-8 text-text-tertiary" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-base shadow-soft">
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          {toolbar}
        </div>
      )}
      {batchBar && batchActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-accent/40 px-4 py-2.5">
          {batchBar}
        </div>
      )}
      <div
        className="overflow-auto scrollbar-thin"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full text-sm" aria-busy={false} aria-describedby={caption ? captionId : undefined}>
          {caption && <caption id={captionId} className="sr-only">{caption}</caption>}
          <thead>
            <tr className={cn("sticky top-0 z-10 border-b border-border/60 bg-surface-muted/95 backdrop-blur-md", headPad)}>
              {hasSelection && (
                <th scope="col" className={cn("w-10 text-left", headPad)}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-border-muted accent-primary"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={selectionLabel === "Select row" ? "Select all rows on this page" : selectionLabel}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                // Carbon: 3 of 4 elements (symbol, shape, colour, type) — so
                // `aria-sort` carries the state programmatically instead of the
                // prose aria-label this table used to rely on.
                const ariaSort = !col.sortable ? undefined : isSorted ? (sortOrder === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      "whitespace-nowrap text-xs font-semibold leading-tight text-text-secondary",
                      alignClass[col.align ?? (col.numeric ? "right" : "left")],
                      col.hideBelow && hideBelowClass[col.hideBelow],
                      col.numeric && "tabular-nums",
                      headPad,
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded transition-colors hover:text-text-primary",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          col.numeric && "ml-auto",
                          isSorted && "text-text-primary",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.flatMap((row) => {
              const key = keyExtractor(row);
              const isExpanded = expandedRow === key;
              const isPending = rowPending?.(row) ?? false;
              const isSelected = selection?.selected.has(key) ?? false;
              const canSelect = selection ? (selection.isSelectable ? selection.isSelectable(row) : true) : false;
              const rowEl = (
                <tr
                  key={key}
                  data-row-id={key}
                  aria-busy={isPending || undefined}
                  aria-selected={hasSelection ? isSelected : undefined}
                  className={cn(
                    "border-b border-border/50 transition-colors duration-100",
                    rowMinH,
                    // Hover only, never zebra: on a dense numeric table zebra adds
                    // a second vertical rhythm that fights the column rules, and
                    // combined with selection you get three competing row
                    // backgrounds. Selected wins, then hover, then nothing.
                    isSelected ? "bg-accent/50" : "hover:bg-surface-muted/40",
                    isExpanded && !isSelected && "bg-surface-muted/60",
                    isPending && "opacity-60",
                    highlightedKey === key && "ring-1 ring-inset ring-primary/30",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={(e) => {
                    if (!onRowClick) return;
                    // A row-click must never stand in for a control inside the
                    // row. Clicking "Resolve" or a checkbox would otherwise fire
                    // both handlers, toggling the row open underneath the action.
                    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
                    onRowClick(row);
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!onRowClick || (e.key !== "Enter" && e.key !== " ")) return;
                    // Focus is on a control inside the row, not the row itself.
                    // The old code called preventDefault() here regardless, which
                    // swallowed Space on the selection checkbox (it never toggled)
                    // and expanded the row instead. The control keeps the key.
                    if (e.target !== e.currentTarget) return;
                    e.preventDefault();
                    onRowClick(row);
                  }}
                >
                  {hasSelection && (
                    <td className={cn("align-middle", rowPad)} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer rounded border-border-muted accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        checked={isSelected}
                        disabled={!canSelect || isPending}
                        onChange={() => toggleOne(key)}
                        aria-label={`${selectionLabel}: ${String(
                          (row as Record<string, unknown>).requestNumber ??
                            (row as Record<string, unknown>).supplierName ??
                            key,
                        )}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const cellPad = cn(rowPad, "align-middle");
                    const align = alignClass[col.align ?? (col.numeric ? "right" : "left")];
                    const common = cn(cellPad, align, col.hideBelow && hideBelowClass[col.hideBelow], col.numeric && "tabular-nums");
                    if (col.rowHeader) {
                      return (
                        <th
                          key={col.key}
                          scope="row"
                          className={cn(common, "font-normal")}
                        >
                          {col.render(row)}
                        </th>
                      );
                    }
                    return (
                      <td key={col.key} className={common}>
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              );
              if (!isExpanded || !renderExpanded) return [rowEl];
              return [
                rowEl,
                <tr key={`exp-${key}`} className="border-b border-border/50">
                  <td colSpan={colCount} className="bg-surface-muted/30 p-0">
                    {renderExpanded(row)}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
          {/* A direct child of <table>, as the spec requires. Nested inside
              <tbody> it is invalid markup, and it makes the table's row/column
              model ambiguous for assistive tech -- the totals line stops
              reading as a summary of the rows above it. */}
          {totals && (
            <tfoot className="sticky bottom-0 z-10 border-t-2 border-border bg-surface-muted/95 backdrop-blur-md">
              {totals}
            </tfoot>
          )}
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className={cn("flex items-center justify-between border-t border-border/60 px-4", sizeMap[size].chromeH)}>
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

