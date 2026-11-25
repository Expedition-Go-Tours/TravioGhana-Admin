export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "PROCESSING"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

/** The processor that took the money. Stripe is the default for older rows. */
export type PaymentProvider = "STRIPE" | "PAYPAL";

export function isPaymentPaid(status: PaymentStatus | string): boolean {
  return status === "SUCCEEDED";
}

export interface BookingPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface BookingCustomer {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  phone?: string | null;
}

export interface BookingTour {
  id: string;
  title: string;
  coverPhoto?: string | null;
  supplier: {
    id: string;
    name: string;
  };
}

export interface PendingCancellationPreview {
  refund?: { amount: number; note?: string };
  fee?: number;
  countsTowardRate?: boolean;
  stopSell?: { tourId?: string; marker?: string; blocked?: Array<{ date: string }> };
}

export interface PendingCancellationPayload {
  cancellationCode?: string;
  cancellationCategory?: string;
  explanation?: string;
  supplierNotes?: string;
  [key: string]: unknown;
}

/**
 * Open supplier cancellation request attached to a booking by the admin
 * list/detail serializers (`pendingCancellation`). Nothing has been executed
 * on the booking while this is present.
 */
export interface PendingCancellation {
  id: string;
  status: string;
  createdAt: string;
  payload?: PendingCancellationPayload | null;
  reasonLabel?: string | null;
  categoryLabel?: string | null;
  preview?: PendingCancellationPreview | null;
  stopSellingApplied?: boolean;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentTiming?: "now" | "later";
  // Pay-later bookkeeping. `paidAt` is when the deferred charge actually
  // settled; these three describe what happened on the way there.
  chargeRetries?: number;
  nextRetryAt?: string | null;
  requiresPaymentActionAt?: string | null;
  /** Set by the checkout that created the booking; absent means Stripe. */
  paymentProvider?: PaymentProvider;
  /** Card brand and last four, when checkout captured them. */
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  grossAmount: number;
  currency: string;
  travelDate: string;
  selectedTime?: string | null;
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  commissionRate: number;
  platformCommission: number;
  supplierPayout: number;
  travelers: TravelerData;
  specialRequests?: string | null;
  cancellationReason?: string | null;
  /** Server-resolved, human-readable reason (the raw field can be a code). */
  cancellationReasonLabel?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leadTravelerName?: string | null;
  leadTravelerEmail?: string | null;
  leadTravelerPhone?: string | null;
  pickup?: PickupData | null;
  source?: string;
  offerName?: string | null;
  offerPromoCode?: string | null;
  offerDiscountType?: string | null;
  offerDiscountPct?: number | null;
  offerDiscountFix?: number | null;
  appliedOffer?: {
    id: string;
    name: string;
    offerType: string;
    discountType: string;
    discountPercentage?: number | null;
    fixedDiscountValue?: number | null;
    promoCode?: string | null;
  } | null;
  /**
   * Null for a booking placed without an account (guest checkout): the lead
   * traveller below is then the only identity on the row. Read it through
   * `bookingContact()` rather than dereferencing it directly.
   */
  customer: BookingCustomer | null;
  tour: BookingTour;
  payouts: BookingPayout[];

  // ── Supplier cancellation approval ──────────────────────────────────────
  /** Present while a supplier cancellation request awaits an admin decision. */
  pendingCancellation?: PendingCancellation | null;
  cancellationCode?: string | null;
  cancellationCodeLabel?: string | null;
  cancellationCategory?: string | null;
  cancellationCategoryLabel?: string | null;
  cancellationOrigin?: string | null;
  countsTowardRate?: boolean | null;
  cancellationFee?: number | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  cancelledAt?: string | null;
  cancellationChoiceDeadline?: string | null;
  customerChoice?: string | null;
}

export interface TravelerDetail {
  name?: string;
  age?: number;
  ageGroup?: string;
  specialRequests?: string;
}

export interface TravelerData {
  adults: number;
  children: number;
  infants: number;
  seniors?: number;
  phoneNumber?: string;
  location?: string;
  details?: TravelerDetail[];
  /** Supplier-defined categories (students, youth, …) plus legacy extras. */
  [category: string]: unknown;
}

export interface TravelerCategory {
  key: string;
  count: number;
  singular: string;
  plural: string;
}

const TRAVELER_META_KEYS = new Set([
  "phoneNumber",
  "phone",
  "location",
  "details",
  "name",
  "email",
  "specialRequests",
]);

const TRAVELER_CATEGORY_ORDER = ["adults", "children", "infants", "seniors"];

const TRAVELER_LABELS: Record<string, [string, string]> = {
  adults: ["Adult", "Adults"],
  children: ["Child", "Children"],
  infants: ["Infant", "Infants"],
  seniors: ["Senior", "Seniors"],
  students: ["Student", "Students"],
  youth: ["Youth", "Youths"],
  youths: ["Youth", "Youths"],
  seniorcitizens: ["Senior citizen", "Senior citizens"],
  seniorcitizen: ["Senior citizen", "Senior citizens"],
};

function travelerCountValue(value: unknown): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) return 0;
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** Every numeric traveller category, in a stable presentation order. */
export function travelerCategories(
  travelers: TravelerData | null | undefined,
): TravelerCategory[] {
  if (!travelers || typeof travelers !== "object") return [];

  return (Object.entries(travelers) as [string, unknown][])
    .filter(([key, value]) => !TRAVELER_META_KEYS.has(key) && travelerCountValue(value) > 0)
    .sort(([a], [b]) => {
      const ai = TRAVELER_CATEGORY_ORDER.indexOf(a);
      const bi = TRAVELER_CATEGORY_ORDER.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    })
    .map(([key, value]) => {
      const count = travelerCountValue(value);
      const known = TRAVELER_LABELS[key];
      if (known) return { key, count, singular: known[0], plural: known[1] };
      const singular = key.endsWith("s") ? key.slice(0, -1) : key;
      return {
        key,
        count,
        singular: singular ? singular.charAt(0).toUpperCase() + singular.slice(1) : key,
        plural: key.charAt(0).toUpperCase() + key.slice(1),
      };
    });
}

export interface PickupData {
  mode?: string;
  areaName?: string;
  locationName?: string;
  address?: { name?: string; address?: string; lat?: number; lng?: number } | null;
  time?: string;
  instructions?: string;
  pickupLater?: boolean;
}

export function travelerCount(travelers: TravelerData | null | undefined): number {
  return travelerCategories(travelers).reduce((sum, category) => sum + category.count, 0);
}
