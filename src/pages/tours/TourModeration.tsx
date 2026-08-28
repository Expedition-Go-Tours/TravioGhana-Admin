import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Clock, Flag, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocketInvalidate } from '@/hooks/useSocketEvent';
import { TourListPanel } from './components/TourListPanel';
import { TourDetailPanel } from './components/TourDetailPanel';
import { TourStatCard } from './components/TourStatCard';
import {
  getTourReviewQueue,
  reviewTour,
  getTourDraftReview,
  reviewTourDraft,
} from '@/services/tourService';

const statRow = {
  pending: { icon: Clock, label: 'Pending', variant: 'pending' as const },
  rejected: { icon: Flag, label: 'Flagged', variant: 'error' as const },
  pendingEdits: { icon: AlertTriangle, label: 'Edits', variant: 'warning' as const },
};

export default function TourModeration() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'list' | 'detail'>('list');

  const tourListRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Sync status filter to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (statusFilter === 'all') {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }
    setSearchParams(params, { replace: true });
  }, [statusFilter, setSearchParams, searchParams]);

  // Fetch tours
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-tour-review', statusFilter, search],
    queryFn: () =>
      getTourReviewQueue({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        limit: 50,
      }),
    placeholderData: (prev) => prev,
  });

  const tours = useMemo(() => data?.tours ?? [], [data]);
  const counts = data?.counts ?? { pending: 0, rejected: 0, pendingEdits: 0 };
  const totalCount = data?.pagination?.totalCount ?? 0;

  // Fetch draft review when needed
  const selectedTour = useMemo(
    () => tours.find((t) => t.id === selectedId) ?? null,
    [tours, selectedId]
  );

  const isPendingEdits =
    selectedTour?.status === 'ACTIVE' && selectedTour?.draftStatus === 'PENDING_APPROVAL';

  const { data: draftReview } = useQuery({
    queryKey: ['tour-draft-review', selectedId],
    queryFn: () => getTourDraftReview(selectedId!),
    enabled: !!selectedId && isPendingEdits,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      isPendingEdits
        ? reviewTourDraft(id, { action: 'approve' })
        : reviewTour(id, { action: 'approve' }),
    onSuccess: () => {
      toast.success('Tour approved successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-tour-review'] });
      setSelectedId(null);
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to approve tour');
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      isPendingEdits
        ? reviewTourDraft(id, { action: 'flag', reason })
        : reviewTour(id, { action: 'flag', reason }),
    onSuccess: () => {
      toast.success('Tour flagged for review!');
      queryClient.invalidateQueries({ queryKey: ['admin-tour-review'] });
      setSelectedId(null);
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to flag tour');
    },
  });

  // Socket: realtime refresh
  useSocketInvalidate('admin:tour-update', ['admin-tour-review']);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const currentIndex = tours.findIndex((t) => t.id === selectedId);

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          const nextIndex = currentIndex < tours.length - 1 ? currentIndex + 1 : 0;
          setSelectedId(tours[nextIndex].id);
          break;
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : tours.length - 1;
          setSelectedId(tours[prevIndex].id);
          break;
        }
        case 'Enter': {
          if (selectedId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
          }
          break;
        }
        case 'a': {
          if ((e.metaKey || e.ctrlKey) && selectedId) {
            e.preventDefault();
            approveMutation.mutate(selectedId);
          }
          break;
        }
        case 'f': {
          if (selectedId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
          }
          break;
        }
        case 'Escape': {
          setSelectedId(null);
          break;
        }
      }
    },
    [tours, selectedId, approveMutation]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!selectedId || !tourListRef.current) return;
    const el = tourListRef.current.querySelector(`[data-tour-id="${selectedId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId]);

  const handleApprove = useCallback(() => {
    if (!selectedId) return;
    approveMutation.mutate(selectedId);
  }, [selectedId, approveMutation]);

  const handleFlag = useCallback(
    (reason: string) => {
      if (!selectedId) return;
      flagMutation.mutate({ id: selectedId, reason });
    },
    [selectedId, flagMutation]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobilePanel('detail');
  }, []);

  const handleStatusFilter = useCallback((filter: string) => {
    setStatusFilter(filter);
    setSelectedId(null);
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-surface-base px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Tour Moderation</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalCount} total tours
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stat pills */}
          <div className="hidden items-center gap-2 lg:flex">
            {Object.entries(statRow).map(([key, config]) => (
              <TourStatCard
                key={key}
                label={config.label}
                value={counts[key as keyof typeof counts] ?? 0}
                icon={config.icon}
                variant={config.variant}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="flex border-b border-border/40 bg-surface-base px-4 py-2 lg:hidden">
        <div className="flex w-full rounded-xl bg-surface-muted p-1">
          <button
            onClick={() => setMobilePanel('list')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mobilePanel === 'list'
                ? 'bg-surface-base text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            Tours ({totalCount})
          </button>
          <button
            onClick={() => setMobilePanel('detail')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mobilePanel === 'detail'
                ? 'bg-surface-base text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            Details
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        <div
          className={`w-full lg:w-[420px] lg:block ${
            mobilePanel === 'list' ? 'block' : 'hidden'
          }`}
        >
          <TourListPanel
            ref={tourListRef}
            tours={tours}
            selectedId={selectedId}
            onSelect={handleSelect}
            searchValue={rawSearch}
            onSearchChange={setRawSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilter}
            counts={counts}
            totalCount={totalCount}
            isLoading={isLoading}
          />
        </div>
        <div
          className={`min-w-0 flex-1 bg-surface-base ${
            mobilePanel === 'detail' ? 'block' : 'hidden lg:block'
          }`}
        >
          <TourDetailPanel
            tour={selectedTour}
            draftReview={draftReview ?? null}
            onApprove={handleApprove}
            onFlag={handleFlag}
            isApproving={approveMutation.isPending}
            isFlagging={flagMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
