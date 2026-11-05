import type { Booking, PaymentProvider } from "@/types/booking";

const CARD_BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  "american express": "Amex",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  maestro: "Maestro",
  diners: "Diners Club",
  "diners club": "Diners Club",
};

const PAID_STATUSES = new Set(["SUCCEEDED", "PROCESSING", "REFUNDED", "PARTIALLY_REFUNDED"]);

export interface PaymentReference {
  label: string;
  value: string;
}

export interface PaymentSource {
  provider: PaymentProvider;
  label: "Stripe" | "PayPal";
  card: string | null;
  /** One line for a table cell: "Stripe · Visa •••• 4242". */
  summary: string;
  reference: PaymentReference | null;
  /**
   * Whether a processor was actually involved. A pay-later row that nobody has
   * charged yet has no source worth naming, even though the column defaults to
   * STRIPE.
   */
  hasEvidence: boolean;
}

export function normalizeProvider(provider?: string | null): PaymentProvider {
  return String(provider || "").trim().toUpperCase() === "PAYPAL" ? "PAYPAL" : "STRIPE";
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function cardLabel(brand?: string | null, last4?: string | null): string | null {
  const digits = String(last4 ?? "").replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const key = String(brand ?? "").trim().toLowerCase();
  const name = key ? CARD_BRANDS[key] || titleCase(key) : "Card";
  return `${name} •••• ${digits}`;
}

type PaymentSourceInput = Pick<
  Booking,
  | "paymentProvider"
  | "paymentMethodBrand"
  | "paymentMethodLast4"
  | "stripePaymentIntentId"
  | "stripeCheckoutSessionId"
  | "paypalOrderId"
  | "paypalCaptureId"
  | "paymentStatus"
>;

export function paymentSource(booking: PaymentSourceInput): PaymentSource {
  const provider = normalizeProvider(booking.paymentProvider);
  const label = provider === "PAYPAL" ? "PayPal" : "Stripe";

  // Card fields are Stripe-shaped. A PayPal row that happened to keep them
  // from an abandoned card attempt must not claim a card was charged.
  const card = provider === "STRIPE"
    ? cardLabel(booking.paymentMethodBrand, booking.paymentMethodLast4)
    : null;

  const reference: PaymentReference | null = provider === "PAYPAL"
    ? booking.paypalCaptureId
      ? { label: "PayPal capture", value: booking.paypalCaptureId }
      : booking.paypalOrderId
        ? { label: "PayPal order", value: booking.paypalOrderId }
        : null
    : booking.stripePaymentIntentId
      ? { label: "Stripe PaymentIntent", value: booking.stripePaymentIntentId }
      : booking.stripeCheckoutSessionId
        ? { label: "Stripe Checkout session", value: booking.stripeCheckoutSessionId }
        : null;

  const status = String(booking.paymentStatus || "").trim().toUpperCase();

  return {
    provider,
    label,
    card,
    summary: card ? `${label} · ${card}` : label,
    reference,
    hasEvidence: provider === "PAYPAL" || Boolean(reference) || PAID_STATUSES.has(status),
  };
}
