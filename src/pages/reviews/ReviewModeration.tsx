import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  X,
  Star,
  Check,
  Flag,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Clock,
  AlertTriangle,
  MessageSquareText,
  MapPin,
  Store,
  RefreshCw,
  Inbox,
  BadgeCheck,
  CheckCheck,
  ThumbsUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { useSocketInvalidate } from "@/hooks/useSocketEvent";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import api from "@/lib/axios";
import { cn, timeAgo, getStatusColor } from "@/lib/utils";
import { CustomerProfilePanel } from "./components/CustomerProfilePanel";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Review {
  id: string;
  rating?: number;
  title?: string;
  comment?: string;
  customer?: { id?: string; name?: string; photoURL?: string };
  tour?: { id?: string; title?: string; coverPhoto?: string; supplier?: { id?: string; name?: string; photoURL?: string } };
  photos?: string[];
  createdAt?: string;
  status?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  flagReason?: string;
  flagComment?: string;
  flaggedBy?: string;
  flaggedAt?: string;
  supplierResponse?: string;
  supplierResponseAt?: string;
  verified?: boolean;
  helpfulCount?: number;
  reportCount?: number;
}

interface TourGroup {
  tourId: string;
  tourTitle: string;
  supplierName: string;
  coverPhoto: string | null;
  reviews: Review[];
  avgRating: number;
  totalReviews: number;
  pendingReviewCount: number;
}

const STATUS_PILLS = ["All", "Pending", "Approved", "Rejected", "Flagged"];

const staggerList = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeSlide = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as const } },
};

type StatAccent = "pending" | "flagged" | "active";

const STAT_ACCENT: Record<StatAccent, { bar: string; chip: string; glow: string; icon: string }> = {
  pending: {
    bar: "from-status-pending to-status-pending/15",
    chip: "bg-status-pending/10 text-status-pending ring-status-pending/20",
    glow: "hover:shadow-tinted-lg",
    icon: "text-status-pending",
  },
  flagged: {
    bar: "from-status-flagged to-status-flagged/15",
    chip: "bg-status-flagged/10 text-status-flagged ring-status-flagged/20",
    glow: "hover:shadow-2",
    icon: "text-status-flagged",
  },
  active: {
    bar: "from-status-active to-status-active/15",
    chip: "bg-status-active/10 text-status-active ring-status-active/20",
    glow: "hover:shadow-tinted",
    icon: "text-status-active",
  },
};

function QueueStat({ label, value, icon: Icon, accent, loading }: { label: string; value: number; icon: typeof Clock; accent: StatAccent; loading?: boolean }) {
  const m = STAT_ACCENT[accent];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/80 bg-surface-base p-4 shadow-soft transition-all duration-200",
        m.glow,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", m.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary tabular-nums leading-tight">
            {loading ? <Skeleton className="inline-block h-6 w-10 align-middle" /> : <AnimatedNumber value={value} />}
          </p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", m.chip)}>
          <Icon className={cn("h-4 w-4", m.icon)} />
        </div>
      </div>
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        getStatusColor(status),
      )}
    >
      {status}
    </span>
  );
}

export default function ReviewModerationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [actionReview, setActionReview] = useState<Review | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "flag" | null>(null);
  const [reason, setReason] = useState("");

  const [editReview, setEditReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editTitle, setEditTitle] = useState("");
  const [editComment, setEditComment] = useState("");

  const [deleteReview, setDeleteReview] = useState<Review | null>(null);

  const [editResponseReview, setEditResponseReview] = useState<Review | null>(null);
  const [editResponseText, setEditResponseText] = useState("");

  const [deleteResponseReview, setDeleteResponseReview] = useState<Review | null>(null);

  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const deepLinkHandled = useRef(false);
  const limit = 20;

  useSocketInvalidate("admin:new-review", ["admin", "reviews"]);

  const statusParam = statusFilter === "All" ? "" : statusFilter.toUpperCase();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "reviews", { page, limit, status: statusParam }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusParam) params.set("status", statusParam);
      return api.get(`/reviews/admin/pending?${params.toString()}`).then((r) => r.data);
    },
  });

  const moderateMutation = useMutation({
    mutationFn: (body: { action: string; reason?: string }) =>
      api.patch(`/reviews/${actionReview?.id}/moderate`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews-pending-count"] });
      toast.success(`Review ${actionType}d successfully`);
      closeModerate();
    },
    onError: () => toast.error("Failed to moderate review"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data: body }: { id: string; data: { rating?: number; title?: string; comment?: string } }) =>
      api.patch(`/reviews/${id}/admin`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "reviews"] });
      toast.success("Review updated");
      setEditReview(null);
    },
    onError: () => toast.error("Failed to update review"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}/admin`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews-pending-count"] });
      toast.success("Review deleted");
      setDeleteReview(null);
    },
    onError: () => toast.error("Failed to delete review"),
  });

  const editResponseMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      api.patch(`/reviews/${id}/admin/response`, { response }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "reviews"] });
      toast.success("Response updated");
      setEditResponseReview(null);
    },
    onError: () => toast.error("Failed to update response"),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}/admin/response`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "reviews"] });
      toast.success("Response deleted");
      setDeleteResponseReview(null);
    },
    onError: () => toast.error("Failed to delete response"),
  });

  const rawReviews: Review[] = useMemo(
    () => data?.reviews || data?.data?.reviews || [],
    [data],
  );
  const pagination = data?.pagination || data?.data?.pagination;
  const counts = data?.counts || data?.data?.counts || {};

  const pendingCount = counts?.pending ?? pagination?.totalCount ?? rawReviews.length;
  const flaggedCount = counts?.flagged ?? 0;
  const moderatedTodayCount = counts?.moderatedToday ?? 0;

  const deepLinkReviewId = location.state?.reviewId as string | undefined;
  const openModerate = (type: "approve" | "reject" | "flag", review: Review) => {
    setActionReview(review);
    setActionType(type);
    setReason("");
  };

  useEffect(() => {
    if (!deepLinkReviewId || deepLinkHandled.current || rawReviews.length === 0) return;
    const found = rawReviews.find((r) => r.id === deepLinkReviewId);
    if (found) {
      deepLinkHandled.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      const tourId = found.tour?.id;
      if (tourId) {
        startTransition(() => {
          setSelectedTourId(tourId);
        });
      }
      setTimeout(() => openModerate("approve", found), 0);
    }
  }, [rawReviews, location.pathname, navigate, deepLinkReviewId]);

  const query = searchQuery.toLowerCase().trim();
  const filteredReviews = useMemo(() => {
    if (!query) return rawReviews;
    return rawReviews.filter((r) =>
      [r.customer?.name, r.tour?.title, r.tour?.supplier?.name, r.title, r.comment]
        .some((f) => f?.toLowerCase().includes(query)),
    );
  }, [rawReviews, query]);

  const tourGroups: TourGroup[] = useMemo(() => {
    const map = new Map<string, Review[]>();
    for (const review of filteredReviews) {
      const tourId = review.tour?.id || "unknown";
      if (!map.has(tourId)) map.set(tourId, []);
      map.get(tourId)!.push(review);
    }
    const groups: TourGroup[] = [];
    for (const [tourId, reviews] of map) {
      const first = reviews[0];
      const avgRating = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
      groups.push({
        tourId,
        tourTitle: first?.tour?.title || "Unknown Tour",
        supplierName: first?.tour?.supplier?.name || "",
        coverPhoto: first?.tour?.coverPhoto || null,
        reviews,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        pendingReviewCount: reviews.filter((r) => r.status === "PENDING").length,
      });
    }
    groups.sort((a, b) => {
      if (b.pendingReviewCount !== a.pendingReviewCount) return b.pendingReviewCount - a.pendingReviewCount;
      return a.tourTitle.localeCompare(b.tourTitle);
    });
    return groups;
  }, [filteredReviews]);

  const selectedTour = useMemo(
    () => tourGroups.find((g) => g.tourId === selectedTourId) || null,
    [tourGroups, selectedTourId],
  );

  const [prevTourIdsKey, setPrevTourIdsKey] = useState("");
  const tourIdsKey = tourGroups.map((g) => g.tourId).join("|");
  if (tourIdsKey !== prevTourIdsKey) {
    setPrevTourIdsKey(tourIdsKey);
    if (!tourGroups.some((g) => g.tourId === selectedTourId)) {
      setSelectedTourId(tourGroups[0]?.tourId ?? null);
    }
  }

  const closeModerate = () => {
    setActionReview(null);
    setActionType(null);
    setReason("");
  };

  const handleAction = () => {
    if (!actionType || !actionReview) return;
    const body: { action: string; reason?: string } = { action: actionType };
    if (reason) body.reason = reason;
    moderateMutation.mutate(body);
  };

  const openEdit = (review: Review) => {
    setEditReview(review);
    setEditRating(review.rating || 0);
    setEditTitle(review.title || "");
    setEditComment(review.comment || "");
  };

  const handleEditSave = () => {
    if (!editReview) return;
    editMutation.mutate({
      id: editReview.id,
      data: { rating: editRating, title: editTitle, comment: editComment },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteReview) return;
    deleteMutation.mutate(deleteReview.id);
  };

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
    return (
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(cls, i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-text-tertiary")}
          />
        ))}
      </span>
    );
  };

  const renderAvatar = (url?: string, name?: string) => (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-xs font-bold text-text-tertiary ring-1 ring-border">
      {url ? (
        <OptimizedImage src={url} alt="" width={36} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <span className={url ? "opacity-0" : ""}>{(name || "?").charAt(0).toUpperCase()}</span>
    </div>
  );

  const editableStars = (rating: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-0.5 mt-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className="p-0.5 focus:outline-none"
        >
          <Star className={cn("h-5 w-5", s <= rating ? "fill-amber-400 text-amber-400" : "text-text-tertiary")} />
        </motion.button>
      ))}
      <span className="text-sm text-text-secondary ml-2">{rating}/5</span>
    </div>
  );

  const iconBtn = (extra?: string) =>
    cn(
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
      extra,
    );

  const renderReviewCard = (review: Review) => {
    const status = review.status || "PENDING";
    const isPending = status === "PENDING";

    return (
      <motion.div
        key={review.id}
        variants={fadeSlide}
        layout
        className={cn(
          "group rounded-xl border bg-surface-base p-5 shadow-soft transition-all duration-200 hover:shadow-soft-lg",
          isPending ? "border-status-pending/25" : "border-border/80",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSelectedCustomerId(review.customer?.id || null)}
              className="shrink-0 rounded-full ring-2 ring-border transition-all hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="View customer profile"
            >
              {renderAvatar(review.customer?.photoURL, review.customer?.name)}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {review.customer?.name || "Anonymous"}
                </span>
                {review.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-active" />}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                <span>{timeAgo(review.createdAt)}</span>
                {review.tour?.supplier?.name && (
                  <>
                    <span>·</span>
                    <span className="truncate">{review.tour.supplier.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {renderStars(review.rating || 0)}
              <span className="text-sm font-bold text-text-primary tabular-nums">{review.rating || 0}</span>
            </div>
            <StatusChip status={status} />
          </div>
        </div>

        {review.title && (
          <p className="mt-4 text-sm font-semibold text-text-primary">{review.title}</p>
        )}
        {review.comment && (
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{review.comment}</p>
        )}

        {review.photos && review.photos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {review.photos.map((photo, i) => (
              <motion.img
                key={i}
                src={photo}
                alt=""
                whileHover={{ scale: 1.04 }}
                className="h-20 w-20 cursor-pointer rounded-lg border border-border bg-surface-muted object-cover"
                loading="lazy"
                onClick={() => setLightbox({ images: review.photos!, index: i })}
              />
            ))}
          </div>
        )}

        {review.supplierResponse && (
          <div className="mt-4 rounded-r-lg border-l-2 border-l-status-active bg-surface-muted/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                <MessageSquareText className="mr-1 inline h-3 w-3 -mt-0.5" />
                Response from {review.tour?.supplier?.name || "Supplier"}
                {review.supplierResponseAt && (
                  <span className="ml-1 font-normal normal-case text-text-tertiary">· {timeAgo(review.supplierResponseAt)}</span>
                )}
              </span>
              {can("reviews.moderate") && (
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={iconBtn("text-text-tertiary hover:bg-surface-base hover:text-primary")}
                    title="Edit response"
                    onClick={() => {
                      setEditResponseReview(review);
                      setEditResponseText(review.supplierResponse || "");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={iconBtn("text-text-tertiary hover:bg-status-rejected/10 hover:text-status-rejected")}
                    title="Delete response"
                    onClick={() => setDeleteResponseReview(review)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-primary">{review.supplierResponse}</p>
          </div>
        )}

        {review.status === "FLAGGED" && review.flagReason && (
          <div className="mt-4 rounded-r-lg border-l-2 border-l-status-flagged bg-status-flagged/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-status-flagged">
                <Flag className="mr-1 inline h-3 w-3 -mt-0.5" />
                Flagged by supplier
                {review.flaggedAt && (
                  <span className="ml-1 font-normal normal-case text-text-tertiary">· {timeAgo(review.flaggedAt)}</span>
                )}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-text-primary">{review.flagReason}</p>
            {review.flagComment && (
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">"{review.flagComment}"</p>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            {(review.helpfulCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {review.helpfulCount}
              </span>
            )}
            {(review.reportCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3 text-status-flagged" />
                {review.reportCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPending ? (
              <>
                {can("reviews.moderate") && (
                  <Button size="sm" onClick={() => openModerate("approve", review)}>
                    <Check />
                    Approve
                  </Button>
                )}
                {can("reviews.moderate") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-status-rejected hover:border-status-rejected/30 hover:bg-status-rejected/10 hover:text-status-rejected"
                    onClick={() => openModerate("reject", review)}
                  >
                    <X />
                    Reject
                  </Button>
                )}
                {can("reviews.moderate") && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={iconBtn("text-status-pending hover:bg-status-pending/10")}
                    title="Flag"
                    onClick={() => openModerate("flag", review)}
                  >
                    <Flag className="h-4 w-4" />
                  </motion.button>
                )}
                {can("reviews.moderate") && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={iconBtn("text-text-tertiary hover:bg-primary/10 hover:text-primary")}
                    title="Edit review"
                    onClick={() => openEdit(review)}
                  >
                    <Pencil className="h-4 w-4" />
                  </motion.button>
                )}
              </>
            ) : (
              <>
                {can("reviews.moderate") && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={iconBtn("text-text-tertiary hover:bg-primary/10 hover:text-primary")}
                    title="Edit review"
                    onClick={() => openEdit(review)}
                  >
                    <Pencil className="h-4 w-4" />
                  </motion.button>
                )}
                {can("reviews.moderate") && review.status === "FLAGGED" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => openModerate("approve", review)}
                  >
                    <Check />
                    Keep review
                  </Button>
                )}
                {can("reviews.moderate") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-status-rejected hover:bg-status-rejected/10 hover:text-status-rejected"
                    onClick={() => setDeleteReview(review)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const contentKey = `${statusFilter}-${page}`;

  return (
    <div className="space-y-4 md:space-y-5 w-full h-full flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-base hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-text-secondary" />
            </motion.button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Moderation Queue</p>
              <h1 className="text-xl font-bold tracking-tight text-text-primary truncate">Review Moderation</h1>
              <p className="text-sm text-text-secondary truncate">Review, approve, and manage customer feedback across all tours</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center justify-center h-9 px-3 text-xs font-medium rounded-lg border border-border bg-surface-base text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50 gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
              <span className="hidden sm:inline">{isRefetching ? "Refreshing..." : "Refresh"}</span>
            </motion.button>
            <Badge variant="warning" className="px-2.5 py-1 text-xs gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-pending inline-block" />
              {pendingCount} pending
            </Badge>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4"
      >
        <QueueStat label="Pending" value={pendingCount} icon={Clock} accent="pending" loading={isLoading} />
        <QueueStat label="Flagged" value={flaggedCount} icon={Flag} accent="flagged" loading={isLoading} />
        <QueueStat label="Moderated Today" value={moderatedTodayCount} icon={CheckCheck} accent="active" loading={isLoading} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search reviews, customers, tours..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full rounded-lg"
          />
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>
        <div className="flex gap-1 bg-surface-muted p-0.5 rounded-lg border border-border overflow-x-auto scrollbar-none w-full sm:w-auto">
          {STATUS_PILLS.map((pill) => (
            <motion.button
              key={pill}
              layout
              onClick={() => { setStatusFilter(pill); setPage(1); }}
              className={cn(
                "relative px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
                statusFilter === pill ? "text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {statusFilter === pill && (
                <motion.span
                  layoutId="activePill"
                  className="absolute inset-0 bg-surface-base rounded-md border border-border shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{pill}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 grid"
          >
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 bg-surface-base">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border border-border rounded-xl p-6 space-y-5 bg-surface-base">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-status-rejected/10 mb-4">
              <AlertTriangle className="h-7 w-7 text-status-rejected" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">Failed to load reviews</p>
            <p className="text-xs text-text-tertiary mb-5">Could not fetch reviews from the server.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </motion.div>
        ) : tourGroups.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl mb-4",
              query ? "bg-surface-muted" : "bg-status-active/10",
            )}>
              {query ? (
                <Search className="h-7 w-7 text-text-tertiary" />
              ) : (
                <CheckCheck className="h-7 w-7 text-status-active" />
              )}
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">
              {query ? "No reviews match your search" : "All caught up!"}
            </p>
            <p className="text-xs text-text-tertiary">
              {query ? "Try adjusting your search terms." : "There are no reviews waiting for moderation."}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={contentKey}
            variants={staggerList}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 grid flex-1 min-h-0 overflow-hidden"
          >
            <div className="overflow-y-auto space-y-2 pr-1">
              {tourGroups.map((group) => {
                const isSelected = selectedTourId === group.tourId;
                return (
                  <motion.div
                    key={group.tourId}
                    variants={fadeSlide}
                    layout
                    onClick={() => setSelectedTourId(group.tourId)}
                    className={cn(
                      "relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200",
                      isSelected
                        ? "border-primary/30 bg-primary/5 shadow-soft"
                        : "border-border bg-surface-base hover:border-border-muted hover:bg-surface-muted/40 hover:shadow-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-200",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex items-start gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                        {group.coverPhoto ? (
                          <OptimizedImage src={group.coverPhoto} alt="" width={44} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-text-tertiary">
                            {group.tourTitle.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-sm font-semibold text-text-primary">{group.tourTitle}</span>
                          {group.pendingReviewCount > 0 && (
                            <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-status-pending/15 text-[10px] font-bold text-status-pending">
                              {group.pendingReviewCount}
                            </span>
                          )}
                        </div>
                        {group.supplierName && (
                          <p className="mt-0.5 truncate text-xs text-text-tertiary">{group.supplierName}</p>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-text-primary tabular-nums">{group.avgRating.toFixed(1)}</span>
                          <span>· {group.totalReviews}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="min-h-0 flex flex-col overflow-hidden">
              {selectedTour ? (
                <>
                  <div className="mb-5 flex items-center gap-4 rounded-xl border border-border/80 bg-surface-base p-4 shadow-soft">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {selectedTour.coverPhoto ? (
                        <OptimizedImage src={selectedTour.coverPhoto} alt="" width={56} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-text-tertiary">
                          {selectedTour.tourTitle.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                        <h2 className="truncate text-base font-semibold text-text-primary">{selectedTour.tourTitle}</h2>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                        {selectedTour.supplierName && (
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {selectedTour.supplierName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {renderStars(selectedTour.avgRating)}
                          <span className="font-semibold text-text-primary tabular-nums">{selectedTour.avgRating.toFixed(1)}</span>
                        </span>
                        <span>· {selectedTour.totalReviews} review{selectedTour.totalReviews !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {selectedTour.pendingReviewCount > 0 && (
                      <Badge variant="warning" className="shrink-0 text-[10px] px-2 py-1">
                        {selectedTour.pendingReviewCount} pending
                      </Badge>
                    )}
                  </div>

                  <motion.div
                    variants={staggerList}
                    initial="hidden"
                    animate="visible"
                    className="overflow-y-auto space-y-4 flex-1 pr-1"
                  >
                    {selectedTour.reviews.map((review) => renderReviewCard(review))}
                  </motion.div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-muted mb-4">
                    <Inbox className="h-7 w-7 text-text-tertiary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-1">No reviews to display</p>
                  <p className="text-xs text-text-tertiary">Select a tour from the queue to review its feedback.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {pagination && pagination.totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-border rounded-xl bg-surface-base"
        >
          <p className="text-xs text-text-tertiary order-2 sm:order-1">
            Page {pagination.currentPage} of {pagination.totalPages} &middot; {pagination.totalCount} total
          </p>
          <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={pagination.currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex flex-1 sm:flex-none items-center justify-center h-9 px-3 text-xs font-medium rounded-lg border border-border bg-surface-base text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:pointer-events-none gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex flex-1 sm:flex-none items-center justify-center h-9 px-3 text-xs font-medium rounded-lg border border-border bg-surface-base text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:pointer-events-none gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85"
            onClick={() => setLightbox(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLightbox(null);
              if (e.key === "ArrowLeft")
                setLightbox((l) => (l ? { ...l, index: Math.max(0, l.index - 1) } : null));
              if (e.key === "ArrowRight")
                setLightbox((l) =>
                  l ? { ...l, index: Math.min(l.images.length - 1, l.index + 1) } : null,
                );
            }}
            tabIndex={0}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              onClick={() => setLightbox(null)}
            >
              <X className="h-6 w-6" />
            </motion.button>

            {lightbox.images.length > 1 && lightbox.index > 0 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => (l ? { ...l, index: l.index - 1 } : null));
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </motion.button>
            )}

            <motion.img
              key={lightbox.index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={lightbox.images[lightbox.index]}
              alt=""
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {lightbox.images.length > 1 && lightbox.index < lightbox.images.length - 1 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => (l ? { ...l, index: l.index + 1 } : null));
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </motion.button>
            )}

            {lightbox.images.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2"
              >
                <span className="px-3 py-1 rounded-full bg-black/40 text-white/80 text-xs">
                  {lightbox.index + 1} / {lightbox.images.length}
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {actionReview && actionType && actionType !== "approve" && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModerate(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{actionType === "reject" ? "Reject Review" : "Flag Review"}</DialogTitle>
              <DialogDescription>
                {actionType === "reject"
                  ? "This review will be removed from the tour page and the customer will be notified."
                  : "This review will be flagged for further investigation."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="reason">
                Reason <span className="text-status-rejected">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this review is being rejected or flagged..."
                rows={3}
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-xs text-status-rejected">Minimum 10 characters required</p>
              )}
              <p className="text-xs text-text-tertiary">{reason.length}/10 minimum</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModerate} disabled={moderateMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant={actionType === "reject" ? "destructive" : "default"}
                disabled={reason.length < 10 || moderateMutation.isPending}
                onClick={handleAction}
              >
                {moderateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Processing...</>
                ) : actionType === "reject" ? (
                  "Reject Review"
                ) : (
                  "Flag Review"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {actionReview && actionType === "approve" && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModerate(); }}>
          <DialogContent className="max-w-xl overflow-hidden p-0">
            <div className="h-1.5 w-full bg-gradient-to-r from-status-active to-status-active/40" />
            <div className="p-6">
              <DialogHeader className="text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-active/10 ring-1 ring-status-active/20">
                    <BadgeCheck className="h-5 w-5 text-status-active" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">
                      {actionReview.status === "FLAGGED" ? "Keep Review" : "Approve Review"}
                    </DialogTitle>
                    <DialogDescription>
                      {actionReview.status === "FLAGGED"
                        ? "Dismiss the flag and restore this review to the tour page."
                        : "This review will be published and become visible to all customers on the tour page."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/40 p-3">
                  {actionReview.tour?.coverPhoto ? (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                      <OptimizedImage
                        src={actionReview.tour.coverPhoto}
                        alt=""
                        width={40}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-base text-sm font-bold text-text-tertiary">
                      {(actionReview.tour?.title || "T").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {actionReview.tour?.title || "Unknown tour"}
                    </p>
                    {actionReview.tour?.supplier?.name && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                        <Store className="h-3 w-3" />
                        {actionReview.tour.supplier.name}
                      </p>
                    )}
                  </div>
                  <Badge className="shrink-0 bg-status-pending/10 px-2 py-0.5 text-[10px] font-semibold text-status-pending ring-1 ring-status-pending/20">
                    {actionReview.status || "PENDING"}
                  </Badge>
                </div>

                <div className="rounded-xl border border-border bg-surface-base p-4">
                  <div className="flex items-start gap-3">
                    {renderAvatar(actionReview.customer?.photoURL, actionReview.customer?.name)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-text-primary">
                          {actionReview.customer?.name || "Anonymous"}
                        </span>
                        {actionReview.verified && (
                          <BadgeCheck className="h-4 w-4 shrink-0 text-status-active" />
                        )}
                        <span className="text-xs text-text-tertiary">· {timeAgo(actionReview.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {renderStars(actionReview.rating || 0)}
                        <span className="text-sm font-bold text-text-primary tabular-nums">{actionReview.rating || 0}</span>
                        <span className="text-xs text-text-tertiary">/ 5</span>
                      </div>
                    </div>
                  </div>
                  {actionReview.title && (
                    <p className="mt-3 text-sm font-semibold text-text-primary">{actionReview.title}</p>
                  )}
                  {actionReview.comment && (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                      {actionReview.comment}
                    </p>
                  )}
                  {actionReview.photos && actionReview.photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actionReview.photos.map((photo, i) => (
                        <motion.img
                          key={i}
                          src={photo}
                          alt=""
                          whileHover={{ scale: 1.04 }}
                          className="h-16 w-16 cursor-pointer rounded-lg border border-border bg-surface-muted object-cover"
                          loading="lazy"
                          onClick={() => setLightbox({ images: actionReview.photos!, index: i })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-5">
                <Button variant="outline" onClick={closeModerate} disabled={moderateMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleAction} disabled={moderateMutation.isPending} className="min-w-[140px]">
                  {moderateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" />Approving...</>
                  ) : (
                    <>Approve Review</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editReview && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditReview(null); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Review</DialogTitle>
              <DialogDescription>
                {editReview.tour?.title
                  ? `Review from ${editReview.customer?.name || "Anonymous"} on "${editReview.tour.title}"`
                  : `Review from ${editReview.customer?.name || "Anonymous"}`}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="h-px flex-1 bg-surface-muted" />
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Original Review</span>
                <div className="h-px flex-1 bg-surface-muted" />
              </div>
              <div className="flex items-start gap-3">
                {renderAvatar(editReview.customer?.photoURL, editReview.customer?.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{editReview.customer?.name || "Anonymous"}</p>
                  <p className="text-xs text-text-tertiary">{timeAgo(editReview.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderStars(editReview.rating || 0)}
                  <span className="text-xs text-text-tertiary ml-1">({editReview.rating || 0}/5)</span>
                </div>
              </div>
              {editReview.title && (
                <p className="text-sm font-medium text-text-primary">{editReview.title}</p>
              )}
              {editReview.comment && (
                <div className="rounded-lg bg-surface-base border border-border p-3">
                  <p className="text-sm text-text-secondary leading-relaxed">{editReview.comment}</p>
                </div>
              )}
            </div>

            <div className="space-y-5 pt-1">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-surface-muted" />
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Edit Fields</span>
                <div className="h-px flex-1 bg-surface-muted" />
              </div>
              <div>
                <Label className="text-sm font-medium">Rating</Label>
                {editableStars(editRating, setEditRating)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Review title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-comment">Comment</Label>
                <Textarea id="edit-comment" value={editComment} onChange={(e) => setEditComment(e.target.value)} placeholder="Review comment" rows={4} className="min-h-[100px]" />
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditReview(null)} disabled={editMutation.isPending}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editMutation.isPending}>
                {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteReview && (
        <Dialog open onOpenChange={(open) => { if (!open) setDeleteReview(null); }}>
          <DialogContent className="max-w-lg space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-status-rejected">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-status-rejected/10">
                  <Trash2 className="h-4 w-4" />
                </div>
                Delete Review
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. The review and all associated data will be permanently removed.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="h-px flex-1 bg-surface-muted" />
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Review to Delete</span>
                <div className="h-px flex-1 bg-surface-muted" />
              </div>
              <div className="flex items-start gap-3">
                {renderAvatar(deleteReview.customer?.photoURL, deleteReview.customer?.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{deleteReview.customer?.name || "Anonymous"}</p>
                  <p className="text-xs text-text-tertiary">{deleteReview.createdAt ? timeAgo(deleteReview.createdAt) : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderStars(deleteReview.rating || 0)}
                  <span className="text-xs text-text-tertiary ml-1">({deleteReview.rating || 0}/5)</span>
                </div>
              </div>
              {deleteReview.title && (
                <p className="text-sm font-medium text-text-primary">{deleteReview.title}</p>
              )}
              {deleteReview.comment && (
                <div className="rounded-lg bg-surface-base border border-border p-3">
                  <p className="text-sm text-text-secondary leading-relaxed">{deleteReview.comment}</p>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary pt-1 border-t border-border">
                <MapPin className="h-3 w-3" />
                <span>on <span className="font-medium text-text-secondary">{deleteReview.tour?.title || "Unknown tour"}</span></span>
              </div>
            </div>

            <div className="rounded-xl border border-status-rejected/20 bg-status-rejected/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-status-rejected/15" />
                <span className="text-[11px] font-semibold text-status-rejected uppercase tracking-wider">Warning</span>
                <div className="h-px flex-1 bg-status-rejected/15" />
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-rejected/10">
                  <AlertTriangle className="h-4 w-4 text-status-rejected" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary">This action cannot be undone</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Deleting this review will permanently remove the review, all associated photos, the supplier response, and moderation history. This cannot be reversed.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button variant="outline" onClick={() => setDeleteReview(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Deleting...</> : "Delete Review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editResponseReview && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditResponseReview(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Supplier Response</DialogTitle>
              <DialogDescription>Update the supplier's response to this review.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="edit-response">Response</Label>
              <Textarea id="edit-response" value={editResponseText} onChange={(e) => setEditResponseText(e.target.value)} placeholder="Supplier response..." rows={4} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditResponseReview(null)} disabled={editResponseMutation.isPending}>Cancel</Button>
              <Button
                onClick={() => { if (!editResponseReview) return; editResponseMutation.mutate({ id: editResponseReview.id, response: editResponseText }); }}
                disabled={!editResponseText.trim() || editResponseMutation.isPending}
              >
                {editResponseMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteResponseReview && (
        <Dialog open onOpenChange={(open) => { if (!open) setDeleteResponseReview(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-status-rejected">
                <Trash2 className="h-5 w-5" /> Delete Response
              </DialogTitle>
              <DialogDescription>This will permanently remove the supplier's response from this review.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-status-rejected/20 bg-status-rejected/5 p-3">
              <p className="text-sm text-status-rejected line-clamp-3">{deleteResponseReview.supplierResponse}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteResponseReview(null)} disabled={deleteResponseMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => { if (!deleteResponseReview) return; deleteResponseMutation.mutate(deleteResponseReview.id); }}
                disabled={deleteResponseMutation.isPending}
              >
                {deleteResponseMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Deleting...</> : "Delete Response"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedCustomerId && (
        <AnimatePresence>
          <CustomerProfilePanel
            customerId={selectedCustomerId}
            onClose={() => setSelectedCustomerId(null)}
          />
        </AnimatePresence>
      )}
    </div>
  );
}
