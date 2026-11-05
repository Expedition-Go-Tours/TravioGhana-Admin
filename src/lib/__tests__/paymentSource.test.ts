import { describe, it, expect } from "vitest";
import { cardLabel, normalizeProvider, paymentSource } from "@/lib/paymentSource";

const base = {
  paymentStatus: "SUCCEEDED",
} as const;

describe("paymentSource", () => {
  it("treats a missing provider as Stripe", () => {
    const source = paymentSource({ ...base });
    expect(source.provider).toBe("STRIPE");
    expect(source.label).toBe("Stripe");
    expect(source.summary).toBe("Stripe");
  });

  it("names the card when checkout captured it", () => {
    const source = paymentSource({
      ...base,
      paymentMethodBrand: "visa",
      paymentMethodLast4: "4242",
    });
    expect(source.card).toBe("Visa •••• 4242");
    expect(source.summary).toBe("Stripe · Visa •••• 4242");
  });

  it("never claims a card was charged on a PayPal row", () => {
    const source = paymentSource({
      ...base,
      paymentProvider: "PAYPAL",
      paymentMethodBrand: "visa",
      paymentMethodLast4: "4242",
    });
    expect(source.label).toBe("PayPal");
    expect(source.card).toBeNull();
    expect(source.summary).toBe("PayPal");
  });

  it("prefers the PayPal capture over the order as the reference", () => {
    const source = paymentSource({
      ...base,
      paymentProvider: "PAYPAL",
      paypalOrderId: "ORDER-1",
      paypalCaptureId: "CAPTURE-1",
    });
    expect(source.reference).toEqual({ label: "PayPal capture", value: "CAPTURE-1" });
  });

  it("falls back to the PayPal order before capture", () => {
    const source = paymentSource({
      ...base,
      paymentProvider: "PAYPAL",
      paypalOrderId: "ORDER-1",
    });
    expect(source.reference).toEqual({ label: "PayPal order", value: "ORDER-1" });
  });

  it("prefers the Stripe PaymentIntent over the checkout session", () => {
    const source = paymentSource({
      ...base,
      stripeCheckoutSessionId: "cs_1",
      stripePaymentIntentId: "pi_1",
    });
    expect(source.reference).toEqual({ label: "Stripe PaymentIntent", value: "pi_1" });
  });

  it("hides the source on a pay-later row that was never charged", () => {
    const source = paymentSource({ paymentStatus: "PENDING" });
    expect(source.hasEvidence).toBe(false);
  });

  it("shows the source once a processor is named", () => {
    const source = paymentSource({
      paymentStatus: "PENDING",
      paymentProvider: "PAYPAL",
    });
    expect(source.hasEvidence).toBe(true);
  });
});

describe("cardLabel", () => {
  it("formats a known brand", () => {
    expect(cardLabel("mastercard", "4444")).toBe("Mastercard •••• 4444");
  });

  it("title-cases an unknown brand instead of dropping it", () => {
    expect(cardLabel("eftpos", "1111")).toBe("Eftpos •••• 1111");
  });

  it("returns null without a full last-four", () => {
    expect(cardLabel("visa", "42")).toBeNull();
    expect(cardLabel("visa", null)).toBeNull();
  });
});

describe("normalizeProvider", () => {
  it("folds anything that is not PayPal into Stripe", () => {
    expect(normalizeProvider("paypal")).toBe("PAYPAL");
    expect(normalizeProvider("STRIPE")).toBe("STRIPE");
    expect(normalizeProvider(null)).toBe("STRIPE");
  });
});
