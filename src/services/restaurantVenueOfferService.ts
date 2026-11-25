import api from "@/lib/axios";
import { BRAND_KEY } from "@/lib/brand";

/**
 * Special offers for restaurant venues.
 *
 * These routes live on the shared `/api/admin/restaurant-venues` router, not
 * the Ghana-branded `/api/travioghana/admin/*` router. The axios interceptor
 * already leaves this prefix untouched, so service calls use it verbatim.
 */

export type RestaurantOfferDiscountType = "PERCENTAGE" | "FIXED";

export interface RestaurantVenueOffer {
  id: string;
  venueId: string;
  brand: string;
  title: string;
  discountType: RestaurantOfferDiscountType;
  discountValue: number;
  promoCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  terms: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantVenueOfferInput {
  brand: string;
  title: string;
  discountType: RestaurantOfferDiscountType;
  discountValue: number;
  promoCode?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  terms?: string;
}

export interface ListRestaurantVenueOffersOptions {
  brand?: string;
  signal?: AbortSignal;
}

export const RESTAURANT_VENUE_OFFERS_BASE_QUERY_KEY = [
  "admin",
  "restaurant-venue-offers",
] as const;

export const RESTAURANT_VENUE_OFFERS_QUERY_KEY = (venueId: string) =>
  [...RESTAURANT_VENUE_OFFERS_BASE_QUERY_KEY, venueId] as const;

function offersPath(venueId: string): string {
  return `/admin/restaurant-venues/${encodeURIComponent(venueId)}/offers`;
}

function offerPath(venueId: string, offerId: string): string {
  return `${offersPath(venueId)}/${encodeURIComponent(offerId)}`;
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Keep the body shape identical for create and edit. */
export function toRestaurantVenueOfferBody(input: RestaurantVenueOfferInput) {
  const body: Record<string, unknown> = {
    brand: input.brand,
    title: input.title.trim(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    isActive: input.isActive,
  };

  const promoCode = optionalString(input.promoCode);
  const startsAt = optionalString(input.startsAt);
  const endsAt = optionalString(input.endsAt);
  const terms = optionalString(input.terms);

  if (promoCode) body.promoCode = promoCode;
  if (startsAt) body.startsAt = startsAt;
  if (endsAt) body.endsAt = endsAt;
  if (terms) body.terms = terms;

  return body;
}

function unwrapOffers(payload: unknown): RestaurantVenueOffer[] {
  const envelope = payload as { data?: unknown } | undefined;
  const inner = envelope?.data !== undefined ? envelope.data : payload;

  if (Array.isArray(inner)) return inner as RestaurantVenueOffer[];
  if (inner && typeof inner === "object") {
    const offers = (inner as { offers?: unknown }).offers;
    if (Array.isArray(offers)) return offers as RestaurantVenueOffer[];
  }

  return [];
}

function unwrapOffer(payload: unknown): RestaurantVenueOffer {
  const envelope = payload as { data?: unknown } | undefined;
  const inner = envelope?.data !== undefined ? envelope.data : payload;

  if (inner && typeof inner === "object") {
    const offer = (inner as { offer?: unknown }).offer;
    if (offer && typeof offer === "object") return offer as RestaurantVenueOffer;
  }

  return inner as RestaurantVenueOffer;
}

export function listRestaurantVenueOffers(
  venueId: string,
  { brand = BRAND_KEY, signal }: ListRestaurantVenueOffersOptions = {},
): Promise<RestaurantVenueOffer[]> {
  return api
    .get(offersPath(venueId), { params: { brand }, signal })
    .then((response) => unwrapOffers(response.data));
}

export function createRestaurantVenueOffer(
  venueId: string,
  input: RestaurantVenueOfferInput,
): Promise<RestaurantVenueOffer> {
  return api
    .post(offersPath(venueId), toRestaurantVenueOfferBody(input), {
      skipGlobalErrorHandler: true,
    })
    .then((response) => unwrapOffer(response.data));
}

export function updateRestaurantVenueOffer(
  venueId: string,
  offerId: string,
  input: RestaurantVenueOfferInput,
): Promise<RestaurantVenueOffer> {
  return api
    .patch(offerPath(venueId, offerId), toRestaurantVenueOfferBody(input), {
      skipGlobalErrorHandler: true,
    })
    .then((response) => unwrapOffer(response.data));
}

export function deleteRestaurantVenueOffer(venueId: string, offerId: string): Promise<void> {
  return api
    .delete(offerPath(venueId, offerId), { skipGlobalErrorHandler: true })
    .then(() => undefined);
}

/** Server message first, so validation failures stay meaningful. */
export function getRestaurantVenueOfferErrorMessage(error: unknown, fallback: string): string {
  const e = error as {
    message?: string;
    response?: { data?: { message?: string; error?: { message?: string } } };
  };
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error?.message ||
    e?.message ||
    fallback
  );
}

/** Convert an existing row into the full PATCH body, including active state. */
export function offerToRestaurantVenueOfferInput(
  offer: RestaurantVenueOffer,
  brand: string = BRAND_KEY,
): RestaurantVenueOfferInput {
  const input: RestaurantVenueOfferInput = {
    brand,
    title: offer.title,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    isActive: offer.isActive,
  };
  if (offer.promoCode) input.promoCode = offer.promoCode;
  if (offer.startsAt) input.startsAt = offer.startsAt;
  if (offer.endsAt) input.endsAt = offer.endsAt;
  if (offer.terms) input.terms = offer.terms;
  return input;
}
