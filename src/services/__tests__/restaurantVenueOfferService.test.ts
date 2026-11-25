import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from "@/lib/axios";
import {
  createRestaurantVenueOffer,
  deleteRestaurantVenueOffer,
  getRestaurantVenueOfferErrorMessage,
  listRestaurantVenueOffers,
  offerToRestaurantVenueOfferInput,
  RESTAURANT_VENUE_OFFERS_QUERY_KEY,
  toRestaurantVenueOfferBody,
  updateRestaurantVenueOffer,
} from "@/services/restaurantVenueOfferService";
import type {
  RestaurantVenueOffer,
  RestaurantVenueOfferInput,
} from "@/services/restaurantVenueOfferService";

const offer = {
  id: "offer_1",
  venueId: "venue_1",
  brand: "ghana",
  title: "Lunch special",
  discountType: "PERCENTAGE",
  discountValue: 15,
  promoCode: "LUNCH15",
  startsAt: "2026-12-01T08:00:00.000Z",
  endsAt: "2026-12-31T23:00:00.000Z",
  isActive: true,
  terms: "Weekdays only",
} as RestaurantVenueOffer;

const input: RestaurantVenueOfferInput = {
  brand: "ghana",
  title: "  Lunch special  ",
  discountType: "FIXED",
  discountValue: 25,
  promoCode: "  SAVE25  ",
  startsAt: "2026-12-01T08:00:00.000Z",
  endsAt: "2026-12-31T23:00:00.000Z",
  isActive: false,
  terms: "  One per table  ",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("restaurantVenueOfferService", () => {
  it("lists offers through the shared restaurant-venue route with the brand filter", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "success", data: { offers: [offer] } },
    });

    await expect(listRestaurantVenueOffers("venue 1")).resolves.toEqual([offer]);
    expect(api.get).toHaveBeenCalledWith("/admin/restaurant-venues/venue%201/offers", {
      params: { brand: "ghana" },
      signal: undefined,
    });
  });

  it("forwards an explicit brand and abort signal when listing", async () => {
    const signal = new AbortController().signal;
    vi.mocked(api.get).mockResolvedValue({ data: { offers: [] } });

    await listRestaurantVenueOffers("venue_1", { brand: "expedition", signal });

    expect(api.get).toHaveBeenCalledWith("/admin/restaurant-venues/venue_1/offers", {
      params: { brand: "expedition" },
      signal,
    });
  });

  it("scopes the query key to the venue", () => {
    expect(RESTAURANT_VENUE_OFFERS_QUERY_KEY("venue_1")).toEqual([
      "admin",
      "restaurant-venue-offers",
      "venue_1",
    ]);
  });

  it("maps a trimmed create body and unwraps a nested offer", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { offer } } });

    await expect(createRestaurantVenueOffer("venue_1", input)).resolves.toEqual(offer);
    expect(api.post).toHaveBeenCalledWith(
      "/admin/restaurant-venues/venue_1/offers",
      {
        brand: "ghana",
        title: "Lunch special",
        discountType: "FIXED",
        discountValue: 25,
        promoCode: "SAVE25",
        startsAt: "2026-12-01T08:00:00.000Z",
        endsAt: "2026-12-31T23:00:00.000Z",
        isActive: false,
        terms: "One per table",
      },
      { skipGlobalErrorHandler: true },
    );
  });

  it("omits blank optional fields from the body", () => {
    expect(
      toRestaurantVenueOfferBody({
        brand: "ghana",
        title: "  Meal deal  ",
        discountType: "PERCENTAGE",
        discountValue: 10,
        promoCode: "   ",
        terms: "  ",
        isActive: true,
      }),
    ).toEqual({
      brand: "ghana",
      title: "Meal deal",
      discountType: "PERCENTAGE",
      discountValue: 10,
      isActive: true,
    });
  });

  it("updates an encoded offer id with the same body shape", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { offer } });

    await expect(
      updateRestaurantVenueOffer("venue 1", "offer 1", input),
    ).resolves.toEqual(offer);
    expect(api.patch).toHaveBeenCalledWith(
      "/admin/restaurant-venues/venue%201/offers/offer%201",
      expect.objectContaining({ title: "Lunch special", isActive: false }),
      { skipGlobalErrorHandler: true },
    );
  });

  it("deletes an offer with a suppressed global error toast", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { data: { deleted: true } } });

    await expect(deleteRestaurantVenueOffer("venue_1", "offer_1")).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith(
      "/admin/restaurant-venues/venue_1/offers/offer_1",
      { skipGlobalErrorHandler: true },
    );
  });

  it("accepts a bare array list response", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [offer] });

    await expect(listRestaurantVenueOffers("venue_1")).resolves.toEqual([offer]);
  });

  it("surfaces server validation messages", () => {
    const error = {
      message: "Request failed",
      response: { status: 400, data: { message: "Discount value must be positive" } },
    };

    expect(getRestaurantVenueOfferErrorMessage(error, "Fallback")).toBe(
      "Discount value must be positive",
    );
    expect(getRestaurantVenueOfferErrorMessage({}, "Fallback")).toBe("Fallback");
  });

  it("round-trips an existing offer into a full update input", () => {
    expect(offerToRestaurantVenueOfferInput(offer)).toEqual({
      brand: "ghana",
      title: "Lunch special",
      discountType: "PERCENTAGE",
      discountValue: 15,
      promoCode: "LUNCH15",
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-31T23:00:00.000Z",
      isActive: true,
      terms: "Weekdays only",
    });
  });
});
