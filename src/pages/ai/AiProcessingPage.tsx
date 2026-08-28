import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  RefreshCw,
  Clock,
  Image as ImageIcon,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Timer,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { SectionError } from "@/components/shared/SectionError";
import { fadeIn, fadeInUp } from "@/lib/animations";
import { toast } from "sonner";
import {
  fetchAiStatus,
  fetchAiFailed,
  retryAiFailed,
  type AiStatusResponse,
  type AiFailedTour,
  type AiFailedImage,
} from "@/services/aiService";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Stat Card Skeleton ──────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </Card>
  );
}

// ── Cron Status Section ─────────────────────────────────────────────────

function CronStatusSection({ status }: { status: AiStatusResponse["cron"] }) {
  return (
    <motion.div variants={fadeIn}>
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  status.running
                    ? "bg-status-active/15 text-status-active"
                    : "bg-status-rejected/15 text-status-rejected"
                }`}
              >
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Cron Fallback Scheduler
                </p>
                <p className="text-xs text-text-tertiary">
                  Processes PENDING tours without Redis
                </p>
              </div>
            </div>
            <Badge variant={status.running ? "success" : "error"}>
              {status.running ? "Running" : "Stopped"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase text-text-tertiary">
                Interval
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {formatMs(status.config.intervalMs)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-text-tertiary">
                Max / Cycle
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {status.config.maxToursPerCycle}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-text-tertiary">
                Delay Between
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {formatMs(status.config.delayBetweenMs)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-text-tertiary">
                Processing Now
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {status.processing ? (
                  <span className="flex items-center gap-1 text-status-pending">
                    <Loader2 className="h-3 w-3 animate-spin" /> Yes
                  </span>
                ) : (
                  "No"
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Image & Attraction Stats ────────────────────────────────────────────

function DetailStatsRow({
  imageStats,
  attractionStats,
}: {
  imageStats: AiStatusResponse["imageAnalysis"];
  attractionStats: AiStatusResponse["attractions"];
}) {
  return (
    <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Image Analysis */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Image Analysis
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">Total Images</span>
              <span className="text-sm font-semibold text-text-primary">
                {imageStats.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <CheckCircle2 className="h-3 w-3 text-status-active" />
                Completed
              </span>
              <span className="text-sm font-semibold text-status-active">
                {imageStats.completed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Clock className="h-3 w-3 text-status-pending" />
                Pending
              </span>
              <span className="text-sm font-semibold text-status-pending">
                {imageStats.pending}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <XCircle className="h-3 w-3 text-status-rejected" />
                Failed
              </span>
              <span className="text-sm font-semibold text-status-rejected">
                {imageStats.failed}
              </span>
            </div>
            {/* Progress bar */}
            {imageStats.total > 0 && (
              <div className="pt-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-status-active transition-all duration-500"
                    style={{
                      width: `${Math.round(
                        (imageStats.completed / imageStats.total) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-text-tertiary">
                  {Math.round((imageStats.completed / imageStats.total) * 100)}%
                  complete
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attractions */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Attractions
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">
                Total Attractions
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {attractionStats.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Zap className="h-3 w-3 text-status-approved" />
                AI Selected Image
              </span>
              <span className="text-sm font-semibold text-status-approved">
                {attractionStats.ai_selected}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <RotateCcw className="h-3 w-3 text-status-pending" />
                Fallback Image
              </span>
              <span className="text-sm font-semibold text-status-pending">
                {attractionStats.fallback_image}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <RefreshCw className="h-3 w-3 text-text-tertiary" />
                Manual Override
              </span>
              <span className="text-sm font-semibold text-text-secondary">
                {attractionStats.manual_override}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Failed Tours Table ──────────────────────────────────────────────────

function FailedToursTable({
  tours,
  onRetry,
  isRetrying,
}: {
  tours: AiFailedTour[];
  onRetry: (ids: string[]) => void;
  isRetrying: boolean;
}) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-rejected" />
              <h3 className="text-sm font-semibold text-text-primary">
                Failed Tours
              </h3>
              <Badge variant="error">{tours.length}</Badge>
            </div>
            {tours.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(tours.map((t) => t.id))}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                )}
                Retry All
              </Button>
            )}
          </div>
          {tours.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-tertiary">
              No failed tours — all processing successfully
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-muted text-[11px] font-medium uppercase text-text-tertiary">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Category</th>
                    <th className="pb-2 pr-4">City</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {tours.map((tour) => (
                    <tr key={tour.id} className="text-text-secondary">
                      <td className="py-2.5 pr-4 font-medium text-text-primary">
                        {tour.title}
                      </td>
                      <td className="py-2.5 pr-4">
                        {tour.category ? (
                          <Badge variant="outline">{tour.category}</Badge>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">{tour.city || "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-text-tertiary">
                        {timeAgo(tour.createdAt)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRetry([tour.id])}
                          disabled={isRetrying}
                          className="h-7 px-2 text-xs"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Failed Images Table ─────────────────────────────────────────────────

function FailedImagesTable({ images }: { images: AiFailedImage[] }) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-status-rejected" />
            <h3 className="text-sm font-semibold text-text-primary">
              Failed Image Analyses
            </h3>
            <Badge variant="error">{images.length}</Badge>
          </div>
          {images.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-tertiary">
              No failed image analyses
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-muted text-[11px] font-medium uppercase text-text-tertiary">
                    <th className="pb-2 pr-4">Tour ID</th>
                    <th className="pb-2 pr-4">Image URL</th>
                    <th className="pb-2 pr-4">Retries</th>
                    <th className="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {images.map((img) => (
                    <tr key={img.id} className="text-text-secondary">
                      <td className="py-2.5 pr-4 font-mono text-xs text-text-primary">
                        {img.tourId.slice(0, 8)}...
                      </td>
                      <td
                        className="max-w-[200px] truncate py-2.5 pr-4 text-xs text-text-tertiary"
                        title={img.imageUrl}
                      >
                        {img.imageUrl.split("/").pop()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={
                            img.aiRetryCount >= 3 ? "error" : "warning"
                          }
                        >
                          {img.aiRetryCount}/3
                        </Badge>
                      </td>
                      <td className="max-w-[200px] truncate py-2.5 text-xs text-text-tertiary">
                        {img.aiDescription || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function AiProcessingPage() {
  const queryClient = useQueryClient();

  // Fetch status
  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["admin", "ai-status"],
    queryFn: fetchAiStatus,
    refetchInterval: 10_000, // live refresh every 10s
  });

  // Fetch failed items
  const {
    data: failed,
    isLoading: failedLoading,
    isError: failedError,
    refetch: refetchFailed,
  } = useQuery({
    queryKey: ["admin", "ai-failed"],
    queryFn: fetchAiFailed,
    refetchInterval: 15_000,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (tourIds?: string[]) => retryAiFailed(tourIds),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-failed"] });
    },
    onError: () => {
      toast.error("Failed to retry AI processing");
    },
  });

  const handleRefresh = () => {
    refetchStatus();
    refetchFailed();
  };

  const handleRetry = (tourIds: string[]) => {
    retryMutation.mutate(tourIds);
  };

  // Loading state
  if (statusLoading || failedLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state
  if (statusError || failedError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            AI Processing
          </h1>
          <p className="mt-0.5 text-sm text-text-tertiary">
            MiMo image analysis & tour classification status
          </p>
        </div>
        <SectionError
          message="Failed to load AI processing status"
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  const tours = status?.tours || {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            AI Processing Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-text-tertiary">
            MiMo image analysis & tour classification status
            {status?.lastProcessed && (
              <span className="ml-2 text-text-tertiary">
                · Last processed: {status.lastProcessed.title} (
                {timeAgo(status.lastProcessed.at)})
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tour Processing Stats */}
      <motion.div
        variants={fadeIn}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Total Active Tours"
          value={String(tours.total)}
          icon={<Brain className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Completed"
          value={String(tours.completed)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
          subtitle={
            tours.total > 0
              ? `${Math.round((tours.completed / tours.total) * 100)}% of total`
              : undefined
          }
        />
        <StatCard
          label="Pending"
          value={String(tours.pending)}
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
          subtitle={
            tours.processing > 0
              ? `${tours.processing} processing now`
              : undefined
          }
        />
        <StatCard
          label="Failed"
          value={String(tours.failed)}
          icon={<XCircle className="h-5 w-5" />}
          accent="red"
        />
      </motion.div>

      {/* Cron Status */}
      {status?.cron && <CronStatusSection status={status.cron} />}

      {/* Image & Attraction Detail Stats */}
      {status && (
        <DetailStatsRow
          imageStats={status.imageAnalysis}
          attractionStats={status.attractions}
        />
      )}

      {/* Failed Tours */}
      {failed && (
        <FailedToursTable
          tours={failed.tours}
          onRetry={handleRetry}
          isRetrying={retryMutation.isPending}
        />
      )}

      {/* Failed Images */}
      {failed && <FailedImagesTable images={failed.failedImages} />}
    </div>
  );
}
