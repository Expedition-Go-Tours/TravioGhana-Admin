import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionError } from "@/components/shared/SectionError";
import { usePermission } from "@/hooks/usePermission";
import { storefrontLabel } from "@/lib/brand";
import { cn, formatDateTime, getStatusColor, timeAgo } from "@/lib/utils";
import {
  getRestaurantClaimErrorMessage,
  getRestaurantClaimErrorStatus,
  listPendingRestaurantClaims,
  resolveRestaurantClaim,
  RESTAURANT_CLAIMS_QUERY_KEY,
} from "@/services/restaurantClaimService";
import type {
  RestaurantClaim,
  RestaurantClaimAction,
} from "@/services/restaurantClaimService";

const PAGE_LIMIT = 20;
const NOTE_LIMIT = 500;

interface Decision {
  claim: RestaurantClaim;
  action: RestaurantClaimAction;
}

function ClaimSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-base p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <Skeleton className="mt-5 h-20 w-full" />
      <Skeleton className="mt-5 h-8 w-32" />
    </div>
  );
}

function DetailRow({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-text-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function ClaimCard({
  claim,
  highlighted,
  canDecide,
  busy,
  onDecide,
}: {
  claim: RestaurantClaim;
  highlighted: boolean;
  canDecide: boolean;
  busy: boolean;
  onDecide: (action: RestaurantClaimAction, claim: RestaurantClaim) => void;
}) {
  return (
    <article
      id={`restaurant-claim-${claim.id}`}
      aria-label={`Claim for ${claim.venueName || "restaurant"}`}
      className={cn(
        "flex flex-col rounded-xl border bg-surface-base p-5 transition-shadow",
        highlighted
          ? "border-primary ring-2 ring-primary/30 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
          : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-text-primary">
            {claim.venueName || "Unknown venue"}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{storefrontLabel(claim.brand)}</Badge>
            {claim.venueCity && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                <MapPin className="h-3 w-3" />
                {claim.venueCity}
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            getStatusColor(claim.status),
          )}
        >
          {claim.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <DetailRow icon={User}>
          {claim.claimantName || claim.claimantEmail || "Unknown claimant"}
        </DetailRow>
        <DetailRow icon={Mail}>{claim.contactEmail || claim.claimantEmail || "—"}</DetailRow>
        <DetailRow icon={Building2}>{claim.businessName || "No business name"}</DetailRow>
        <DetailRow icon={FileText}>{claim.role ? `Role: ${claim.role}` : "No role given"}</DetailRow>
        {claim.phone && <DetailRow icon={Phone}>{claim.phone}</DetailRow>}
        {claim.venueSlug && <DetailRow icon={ExternalLink}>Slug: {claim.venueSlug}</DetailRow>}
      </div>

      <div className="mt-4 rounded-lg bg-surface-muted p-3">
        <p className="text-[11px] font-medium text-text-tertiary">Claimant message</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
          {claim.message || "No message provided."}
        </p>
        {claim.evidenceUrl ? (
          <a
            href={claim.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View evidence
          </a>
        ) : (
          <p className="mt-3 text-[11px] text-text-tertiary">No evidence link provided.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <span
          className="inline-flex items-center gap-1 text-[11px] text-text-tertiary"
          title={formatDateTime(claim.createdAt)}
        >
          <Clock className="h-3 w-3" />
          {timeAgo(claim.createdAt)}
        </span>
        {canDecide && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => onDecide("reject", claim)}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => onDecide("approve", claim)}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function RestaurantClaimsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canDecide = can("reviews.moderate");

  const [searchParams, setSearchParams] = useSearchParams();
  const claimIdFromUrl = searchParams.get("claimId");
  const deepLinkHandled = useRef<string | null>(null);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: RESTAURANT_CLAIMS_QUERY_KEY,
    queryFn: ({ pageParam, signal }) =>
      listPendingRestaurantClaims({ limit: PAGE_LIMIT, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
  });

  const claims = useMemo(() => data?.pages.flatMap((page) => page.claims) ?? [], [data]);

  // A notification deep link may point to a claim on a later cursor page.
  // Load pages until it is visible, then scroll it into view and mark it.
  useEffect(() => {
    if (!claimIdFromUrl || deepLinkHandled.current === claimIdFromUrl) return;
    if (claims.some((claim) => claim.id === claimIdFromUrl)) {
      deepLinkHandled.current = claimIdFromUrl;
      const element = document.getElementById(`restaurant-claim-${claimIdFromUrl}`);
      if (typeof element?.scrollIntoView === "function") {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [claimIdFromUrl, claims, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useMemo(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: RESTAURANT_CLAIMS_QUERY_KEY });
    },
    [queryClient],
  );

  const decisionMutation = useMutation({
    mutationFn: resolveRestaurantClaim,
    onSuccess: (claim, variables) => {
      if (variables.action === "approve") {
        toast.success(
          `Claim approved. ${claim.claimantName || "The claimant"} can now manage ${claim.venueName || "this venue"}.`,
        );
      } else {
        toast.success(`Claim rejected for ${claim.venueName || "this venue"}.`);
      }
      refresh();
      if (claimIdFromUrl === variables.claimId) {
        const params = new URLSearchParams(searchParams);
        params.delete("claimId");
        setSearchParams(params, { replace: true });
      }
      setDecision(null);
      setNote("");
    },
    onError: (error, variables) => {
      toast.error(
        getRestaurantClaimErrorMessage(error, `Failed to ${variables.action} claim`),
      );
      if (getRestaurantClaimErrorStatus(error) === 409) refresh();
      setDecision(null);
      setNote("");
    },
  });

  const openDecision = (action: RestaurantClaimAction, claim: RestaurantClaim) => {
    setNote("");
    setDecision({ action, claim });
  };

  const clearDeepLink = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("claimId");
    setSearchParams(params, { replace: true });
  };

  const linkedClaimMissing =
    !!claimIdFromUrl &&
    !isLoading &&
    !hasNextPage &&
    !isFetchingNextPage &&
    !claims.some((claim) => claim.id === claimIdFromUrl);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Restaurant claims"
        subtitle="Review requests from businesses asking to manage a restaurant listing."
      >
        <Badge variant={claims.length > 0 ? "warning" : "secondary"} className="gap-1.5">
          <Clock className="h-3 w-3" />
          {isLoading ? "—" : claims.length} shown
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {!canDecide && (
        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          You can view claims but cannot approve or reject them.
        </p>
      )}

      {linkedClaimMissing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          <span>The linked claim is no longer pending. It may have already been reviewed.</span>
          <Button variant="ghost" size="sm" onClick={clearDeepLink}>
            Dismiss
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ClaimSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-surface-base">
          <SectionError
            message="Failed to load restaurant claims"
            onRetry={() => void refetch()}
          />
        </div>
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
            <Inbox className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-primary">No pending claims</p>
          <p className="mt-1 text-xs text-text-tertiary">
            New owner requests will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              highlighted={claim.id === claimIdFromUrl}
              canDecide={canDecide}
              busy={decisionMutation.isPending}
              onDecide={openDecision}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-2"
          >
            {isFetchingNextPage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {decision && (
        <Dialog open onOpenChange={(open) => { if (!open) setDecision(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {decision.action === "approve" ? "Approve claim" : "Reject claim"}
              </DialogTitle>
              <DialogDescription>
                {decision.action === "approve"
                  ? `${decision.claim.claimantName || "This claimant"} will become an active owner of ${decision.claim.venueName || "this venue"}.`
                  : `${decision.claim.claimantName || "This claimant"} will not gain access to ${decision.claim.venueName || "this venue"}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="claim-review-note">Admin note (optional)</Label>
              <Textarea
                id="claim-review-note"
                value={note}
                maxLength={NOTE_LIMIT}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Record why this decision was made."
              />
              <p className="text-right text-[11px] text-text-tertiary tnum">
                {note.length}/{NOTE_LIMIT}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                variant={decision.action === "reject" ? "destructive" : "default"}
                disabled={decisionMutation.isPending}
                onClick={() =>
                  decisionMutation.mutate({
                    claimId: decision.claim.id,
                    action: decision.action,
                    note,
                  })
                }
              >
                {decisionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {decision.action === "approve" ? "Approve claim" : "Reject claim"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
