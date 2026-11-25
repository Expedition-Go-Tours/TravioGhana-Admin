import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionError } from "@/components/shared/SectionError";
import { usePermission } from "@/hooks/usePermission";
import { BRAND_KEY, storefrontLabel } from "@/lib/brand";
import { cn, formatDateTime, getStatusColor } from "@/lib/utils";
import {
  createRestaurantVenueOffer,
  deleteRestaurantVenueOffer,
  getRestaurantVenueOfferErrorMessage,
  listRestaurantVenueOffers,
  offerToRestaurantVenueOfferInput,
  RESTAURANT_VENUE_OFFERS_QUERY_KEY,
  updateRestaurantVenueOffer,
} from "@/services/restaurantVenueOfferService";
import type {
  RestaurantOfferDiscountType,
  RestaurantVenueOffer,
  RestaurantVenueOfferInput,
} from "@/services/restaurantVenueOfferService";

interface OfferFormValues {
  title: string;
  discountType: RestaurantOfferDiscountType;
  discountValue: string;
  promoCode: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  terms: string;
}

type OfferFormErrors = Partial<Record<keyof OfferFormValues, string>>;

const EMPTY_FORM: OfferFormValues = {
  title: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  promoCode: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  terms: "",
};

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-text-primary transition-colors hover:border-text-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

interface Notice {
  kind: "success" | "error";
  message: string;
}

interface SaveVariables {
  offerId?: string;
  input: RestaurantVenueOfferInput;
}

interface ToggleVariables {
  offer: RestaurantVenueOffer;
  isActive: boolean;
}

function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // datetime-local is timezone-less; convert back to local wall-clock time.
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromDateTimeInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function offerToFormValues(offer: RestaurantVenueOffer): OfferFormValues {
  return {
    title: offer.title,
    discountType: offer.discountType,
    discountValue: String(offer.discountValue),
    promoCode: offer.promoCode ?? "",
    startsAt: toDateTimeInput(offer.startsAt),
    endsAt: toDateTimeInput(offer.endsAt),
    isActive: offer.isActive,
    terms: offer.terms ?? "",
  };
}

function validateOfferForm(values: OfferFormValues): OfferFormErrors {
  const errors: OfferFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Enter a title for the offer.";
  }

  const discountValue = Number(values.discountValue);
  if (!values.discountValue.trim()) {
    errors.discountValue = "Enter a discount value.";
  } else if (!Number.isFinite(discountValue) || discountValue <= 0) {
    errors.discountValue = "Discount value must be greater than 0.";
  }

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;

  if (values.startsAt) {
    startsAt = new Date(values.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      errors.startsAt = "Enter a valid start date.";
      startsAt = null;
    }
  }

  if (values.endsAt) {
    endsAt = new Date(values.endsAt);
    if (Number.isNaN(endsAt.getTime())) {
      errors.endsAt = "Enter a valid end date.";
      endsAt = null;
    }
  }

  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAt = "End date must be after start date.";
  }

  return errors;
}

function offerFormToInput(
  values: OfferFormValues,
  brand: string = BRAND_KEY,
): RestaurantVenueOfferInput {
  const input: RestaurantVenueOfferInput = {
    brand,
    title: values.title.trim(),
    discountType: values.discountType,
    discountValue: Number(values.discountValue),
    isActive: values.isActive,
  };

  const promoCode = values.promoCode.trim();
  const startsAt = fromDateTimeInput(values.startsAt);
  const endsAt = fromDateTimeInput(values.endsAt);
  const terms = values.terms.trim();

  if (promoCode) input.promoCode = promoCode;
  if (startsAt) input.startsAt = startsAt;
  if (endsAt) input.endsAt = endsAt;
  if (terms) input.terms = terms;

  return input;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[11px] text-status-rejected-text">
      {message}
    </p>
  );
}

function DetailRow({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-text-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function OfferCard({
  offer,
  canManage,
  toggling,
  onEdit,
  onDelete,
  onToggle,
}: {
  offer: RestaurantVenueOffer;
  canManage: boolean;
  toggling: boolean;
  onEdit: (offer: RestaurantVenueOffer) => void;
  onDelete: (offer: RestaurantVenueOffer) => void;
  onToggle: (offer: RestaurantVenueOffer, isActive: boolean) => void;
}) {
  return (
    <article
      aria-label={`Offer ${offer.title}`}
      className="rounded-xl border border-border bg-surface-base p-5 transition-shadow"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{offer.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {offer.discountType === "PERCENTAGE"
                ? `${offer.discountValue}% off`
                : `GH₵${offer.discountValue} off`}
            </Badge>
            {offer.promoCode && (
              <Badge variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {offer.promoCode}
              </Badge>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            getStatusColor(offer.isActive ? "ACTIVE" : "SUSPENDED"),
          )}
        >
          {offer.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <DetailRow icon={CalendarDays}>Starts {formatDateTime(offer.startsAt)}</DetailRow>
        <DetailRow icon={Clock}>Ends {formatDateTime(offer.endsAt)}</DetailRow>
      </div>

      {offer.terms && (
        <div className="mt-4 rounded-lg bg-surface-muted p-3">
          <p className="text-[11px] font-medium text-text-tertiary">Terms</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
            {offer.terms}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={offer.isActive}
            disabled={!canManage || toggling}
            onCheckedChange={(checked) => onToggle(offer, checked)}
            aria-label={`Active state for ${offer.title}`}
          />
          <span className="text-xs text-text-secondary">
            {offer.isActive ? "Active" : "Paused"}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(offer)}>
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-status-rejected-text"
              onClick={() => onDelete(offer)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function RestaurantOffersPage() {
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canManage = can("reviews.moderate");

  const [searchParams, setSearchParams] = useSearchParams();
  const venueIdFromUrl = (searchParams.get("venueId") ?? "").trim();
  const [venueDraft, setVenueDraft] = useState<string | null>(null);
  const venueInput = venueDraft ?? venueIdFromUrl;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<RestaurantVenueOffer | null>(null);
  const [form, setForm] = useState<OfferFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<OfferFormErrors>({});
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RestaurantVenueOffer | null>(null);

  const offersQuery = useQuery({
    queryKey: RESTAURANT_VENUE_OFFERS_QUERY_KEY(venueIdFromUrl),
    queryFn: ({ signal }) => listRestaurantVenueOffers(venueIdFromUrl, { signal }),
    enabled: Boolean(venueIdFromUrl),
    refetchOnWindowFocus: false,
  });

  const offers = offersQuery.data ?? [];

  const invalidateOffers = () =>
    queryClient.invalidateQueries({
      queryKey: RESTAURANT_VENUE_OFFERS_QUERY_KEY(venueIdFromUrl),
    });

  const saveMutation = useMutation({
    mutationFn: ({ offerId, input }: SaveVariables) =>
      offerId
        ? updateRestaurantVenueOffer(venueIdFromUrl, offerId, input)
        : createRestaurantVenueOffer(venueIdFromUrl, input),
    onSuccess: (_offer, variables) => {
      const message = variables.offerId ? "Offer updated." : "Offer created.";
      setNotice({ kind: "success", message });
      setDialogOpen(false);
      setEditingOffer(null);
      setFormError("");
      setFieldErrors({});
      toast.success(message);
      void invalidateOffers();
    },
    onError: (error, variables) => {
      const message = getRestaurantVenueOfferErrorMessage(
        error,
        variables.offerId ? "Failed to update offer." : "Failed to create offer.",
      );
      setFormError(message);
      toast.error(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ offer, isActive }: ToggleVariables) =>
      updateRestaurantVenueOffer(venueIdFromUrl, offer.id, {
        ...offerToRestaurantVenueOfferInput(offer),
        isActive,
      }),
    onSuccess: (_offer, variables) => {
      const message = `${variables.offer.title} ${
        variables.isActive ? "activated" : "paused"
      }.`;
      setNotice({ kind: "success", message });
      toast.success(message);
      void invalidateOffers();
    },
    onError: (error) => {
      const message = getRestaurantVenueOfferErrorMessage(error, "Failed to update offer status.");
      setNotice({ kind: "error", message });
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (offer: RestaurantVenueOffer) =>
      deleteRestaurantVenueOffer(venueIdFromUrl, offer.id),
    onSuccess: (_result, offer) => {
      const message = `${offer.title} deleted.`;
      setNotice({ kind: "success", message });
      setDeleteTarget(null);
      toast.success(message);
      void invalidateOffers();
    },
    onError: (error) => {
      const message = getRestaurantVenueOfferErrorMessage(error, "Failed to delete offer.");
      setNotice({ kind: "error", message });
      setDeleteTarget(null);
      toast.error(message);
    },
  });

  const submitVenue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextVenueId = venueInput.trim();
    if (!nextVenueId) {
      setNotice({ kind: "error", message: "Enter a restaurant venue ID to load its offers." });
      return;
    }
    setNotice(null);
    setVenueDraft(null);
    if (nextVenueId !== venueIdFromUrl) {
      setSearchParams({ venueId: nextVenueId });
    }
  };

  const openCreate = () => {
    setEditingOffer(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
    setNotice(null);
    setDialogOpen(true);
  };

  const openEdit = (offer: RestaurantVenueOffer) => {
    setEditingOffer(offer);
    setForm(offerToFormValues(offer));
    setFieldErrors({});
    setFormError("");
    setNotice(null);
    setDialogOpen(true);
  };

  const submitOffer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateOfferForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Fix the highlighted fields before saving.");
      return;
    }
    setFormError("");
    setNotice(null);
    saveMutation.mutate({
      offerId: editingOffer?.id,
      input: offerFormToInput(form),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Restaurant special offers"
        subtitle="Create and manage promotions for a restaurant venue on Travio Ghana."
      >
        <Badge variant="outline" className="gap-1.5">
          <Store className="h-3 w-3" />
          {storefrontLabel(BRAND_KEY)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void offersQuery.refetch()}
          disabled={!venueIdFromUrl || offersQuery.isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", offersQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openCreate} disabled={!venueIdFromUrl}>
            <Plus className="h-3.5 w-3.5" />
            New offer
          </Button>
        )}
      </PageHeader>

      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs",
            notice.kind === "success"
              ? "border-status-active/30 bg-status-active/10 text-status-active-text"
              : "border-status-rejected/30 bg-status-rejected/10 text-status-rejected-text",
          )}
        >
          <span className="flex items-center gap-2">
            {notice.kind === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {notice.message}
          </span>
          <button
            type="button"
            aria-label="Dismiss message"
            className="rounded p-0.5 hover:bg-surface-muted"
            onClick={() => setNotice(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!canManage && (
        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          You can view offers but cannot create, edit, or delete them.
        </p>
      )}

      <form
        onSubmit={submitVenue}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-base p-4"
      >
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <Label htmlFor="restaurant-venue-id">Restaurant venue ID</Label>
          <Input
            id="restaurant-venue-id"
            value={venueInput}
            onChange={(event) => setVenueDraft(event.target.value)}
            placeholder="e.g. venue_123"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Load offers
        </Button>
      </form>

      {!venueIdFromUrl ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
            <Store className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-primary">Choose a restaurant venue</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Enter a venue ID above to load its special offers.
          </p>
        </div>
      ) : offersQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-surface-base p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-5 w-24 rounded-full" />
              <Skeleton className="mt-5 h-3 w-full" />
              <Skeleton className="mt-5 h-8 w-32" />
            </div>
          ))}
        </div>
      ) : offersQuery.isError ? (
        <div className="rounded-xl border border-border bg-surface-base">
          <SectionError
            message="Failed to load restaurant offers"
            onRetry={() => void offersQuery.refetch()}
          />
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
            <Inbox className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-primary">No special offers yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Create the first promotion for this venue.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              canManage={canManage}
              toggling={toggleMutation.isPending}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggle={(target, isActive) => toggleMutation.mutate({ offer: target, isActive })}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingOffer ? "Edit special offer" : "New special offer"}</DialogTitle>
            <DialogDescription>
              Set the discount, schedule and any terms shown to customers.
            </DialogDescription>
          </DialogHeader>

          <form id="restaurant-offer-form" onSubmit={submitOffer} noValidate className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-status-rejected/30 bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected-text"
              >
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="offer-title">Title</Label>
              <Input
                id="offer-title"
                value={form.title}
                aria-invalid={Boolean(fieldErrors.title)}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Weekday lunch special"
              />
              <FieldError message={fieldErrors.title} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-discount-type">Discount type</Label>
                <select
                  id="offer-discount-type"
                  className={SELECT_CLASS}
                  value={form.discountType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      discountType: event.target.value as RestaurantOfferDiscountType,
                    }))
                  }
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-discount-value">Discount value</Label>
                <Input
                  id="offer-discount-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.discountValue}
                  aria-invalid={Boolean(fieldErrors.discountValue)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, discountValue: event.target.value }))
                  }
                  placeholder="10"
                />
                <FieldError message={fieldErrors.discountValue} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="offer-promo-code">Promo code (optional)</Label>
              <Input
                id="offer-promo-code"
                value={form.promoCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, promoCode: event.target.value }))
                }
                placeholder="e.g. LUNCH10"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-starts-at">Starts at (optional)</Label>
                <Input
                  id="offer-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  aria-invalid={Boolean(fieldErrors.startsAt)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                />
                <FieldError message={fieldErrors.startsAt} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-ends-at">Ends at (optional)</Label>
                <Input
                  id="offer-ends-at"
                  type="datetime-local"
                  value={form.endsAt}
                  aria-invalid={Boolean(fieldErrors.endsAt)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endsAt: event.target.value }))
                  }
                />
                <FieldError message={fieldErrors.endsAt} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="offer-terms">Terms (optional)</Label>
              <Textarea
                id="offer-terms"
                value={form.terms}
                onChange={(event) =>
                  setForm((current) => ({ ...current, terms: event.target.value }))
                }
                placeholder="Valid on weekdays only. One per table."
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
                aria-label="Offer is active"
              />
              <span className="text-xs text-text-secondary">Offer is active</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingOffer ? "Save changes" : "Create offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
        title="Delete special offer"
        description={`Delete “${deleteTarget?.title ?? ""}”? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
