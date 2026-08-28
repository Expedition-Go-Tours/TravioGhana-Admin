import { forwardRef } from 'react';
import { Search, MapPin, Clock, Star, Leaf } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SkeletonTourList } from './SkeletonTourList';
import { cn } from '@/lib/utils';
import type { ReviewQueueTour } from '@/services/tourService';

interface TourListPanelProps {
  tours: ReviewQueueTour[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  counts: { pending: number; rejected: number; pendingEdits: number };
  totalCount: number;
  isLoading: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: 'warning' | 'success' | 'error' | 'info' }> = {
  PENDING_APPROVAL: { label: 'Pending', dot: 'bg-status-pending', badge: 'warning' },
  ACTIVE: { label: 'Approved', dot: 'bg-status-active', badge: 'success' },
  REJECTED: { label: 'Flagged', dot: 'bg-status-rejected', badge: 'error' },
  PENDING_EDITS: { label: 'Pending Edits', dot: 'bg-status-approved', badge: 'info' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'REJECTED', label: 'Flagged' },
  { key: 'PENDING_EDITS', label: 'Edits' },
];

export const TourListPanel = forwardRef<HTMLDivElement, TourListPanelProps>(function TourListPanel(
  {
    tours,
    selectedId,
    onSelect,
    searchValue,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    counts,
    totalCount,
    isLoading,
  },
  ref
) {
  return (
    <div ref={ref} className="flex h-full flex-col border-r border-border/40 bg-surface-base">
      <div className="p-4 pb-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tours..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 rounded-xl border-border/60 bg-surface-muted/50 pl-9 text-sm placeholder:text-muted-foreground/60 focus:border-text-secondary/50 focus:ring-text-secondary/20"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const isActive = statusFilter === f.key;
            const count =
              f.key === 'all'
                ? totalCount
                : f.key === 'PENDING_EDITS'
                ? counts.pendingEdits
                : f.key === 'PENDING_APPROVAL'
                ? counts.pending
                : counts[f.key.toLowerCase() as keyof typeof counts] ?? 0;

            return (
              <button
                key={f.key}
                onClick={() => onStatusFilterChange(f.key)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isActive ? 'bg-primary/15 text-primary' : 'bg-surface-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {isLoading ? (
          <SkeletonTourList />
        ) : tours.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 rounded-full bg-surface-muted p-3">
              <Search className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No tours found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Try adjusting your filters</p>
          </div>
        ) : (
          tours.map((tour) => {
            const statusKey =
              tour.status === 'ACTIVE' && tour.draftStatus === 'PENDING_APPROVAL'
                ? 'PENDING_EDITS'
                : tour.status || 'PENDING_APPROVAL';
            const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.PENDING_APPROVAL;
            const isSelected = tour.id === selectedId;

            return (
              <button
                key={tour.id}
                data-tour-id={tour.id}
                onClick={() => onSelect(tour.id)}
                className={cn(
                  'mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150',
                  isSelected
                    ? 'border-l-[3px] border-l-primary bg-accent/40 pl-[9px]'
                    : 'border-l-[3px] border-l-transparent hover:bg-surface-muted/60'
                )}
              >
                <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', config.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {tour.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tour.supplier?.name || 'Unknown Provider'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
                    {tour.category && (
                      <span className="flex items-center gap-1">
                        <Leaf className="h-3 w-3" />
                        {tour.category}
                      </span>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(tour.productContent as Record<string, any>)?.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(tour.productContent as Record<string, any>).duration as string}
                      </span>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(tour.productContent as Record<string, any>)?.difficulty && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(tour.productContent as Record<string, any>).difficulty as string}
                      </span>
                    )}
                    {(tour.city || tour.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[tour.city, tour.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});
