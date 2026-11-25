import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

const permissionState = vi.hoisted(() => ({ canManage: true }));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: (key: string) => (key === "reviews.moderate" ? permissionState.canManage : true),
    isSuperAdmin: permissionState.canManage,
    adminRole: { id: "role_1", name: "reviewer", permissions: ["reviews.view"] },
    loading: false,
    setAdminRole: () => {},
  }),
}));

vi.mock("@/services/restaurantVenueOfferService", () => ({
  RESTAURANT_VENUE_OFFERS_QUERY_KEY: (venueId: string) => [
    "admin",
    "restaurant-venue-offers",
    venueId,
  ],
  listRestaurantVenueOffers: vi.fn(),
  createRestaurantVenueOffer: vi.fn(),
  updateRestaurantVenueOffer: vi.fn(),
  deleteRestaurantVenueOffer: vi.fn(),
  getRestaurantVenueOfferErrorMessage: (_error: unknown, fallback: string) => fallback,
  offerToRestaurantVenueOfferInput: vi.fn((offer: RestaurantVenueOffer) => ({
    brand: offer.brand,
    title: offer.title,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    promoCode: offer.promoCode ?? undefined,
    startsAt: offer.startsAt ?? undefined,
    endsAt: offer.endsAt ?? undefined,
    isActive: offer.isActive,
    terms: offer.terms ?? undefined,
  })),
}));

import {
  createRestaurantVenueOffer,
  deleteRestaurantVenueOffer,
  listRestaurantVenueOffers,
  updateRestaurantVenueOffer,
} from "@/services/restaurantVenueOfferService";
import type { RestaurantVenueOffer } from "@/services/restaurantVenueOfferService";
import RestaurantOffersPage from "../RestaurantOffersPage";

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

const ROUTE = "/admin/restaurant-offers?venueId=venue_1";

beforeEach(() => {
  vi.clearAllMocks();
  permissionState.canManage = true;
  vi.mocked(listRestaurantVenueOffers).mockResolvedValue([offer]);
  vi.mocked(createRestaurantVenueOffer).mockResolvedValue(offer);
  vi.mocked(updateRestaurantVenueOffer).mockResolvedValue(offer);
  vi.mocked(deleteRestaurantVenueOffer).mockResolvedValue(undefined);
});

describe("RestaurantOffersPage", () => {
  it("loads and renders the offers for the selected venue", async () => {
    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    const card = await screen.findByLabelText("Offer Lunch special");
    expect(within(card).getByText("Lunch special")).toBeInTheDocument();
    expect(within(card).getByText("15% off")).toBeInTheDocument();
    expect(within(card).getByText("LUNCH15")).toBeInTheDocument();
    expect(within(card).getByText("Weekdays only")).toBeInTheDocument();
    expect(within(card).getAllByText("Active").length).toBeGreaterThan(0);
    expect(listRestaurantVenueOffers).toHaveBeenCalledWith(
      "venue_1",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("blocks saving until required fields are valid and dates are ordered", async () => {
    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    await userEvent.click(screen.getByRole("button", { name: "New offer" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Create offer" }));

    expect(await screen.findByText("Enter a title for the offer.")).toBeInTheDocument();
    expect(screen.getByText("Enter a discount value.")).toBeInTheDocument();
    expect(screen.getByText("Fix the highlighted fields before saving.")).toBeInTheDocument();
    expect(createRestaurantVenueOffer).not.toHaveBeenCalled();

    // Re-query after each submit: Radix replaces the dialog content on state
    // changes, so holding on to the first node would fire events on a detached
    // input.
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Weekend deal" },
    });
    fireEvent.change(screen.getByLabelText("Discount value"), {
      target: { value: "0" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create offer" }));
    expect(
      await screen.findByText("Discount value must be greater than 0."),
    ).toBeInTheDocument();
    expect(createRestaurantVenueOffer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Discount value"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Starts at (optional)"), {
      target: { value: "2026-12-05T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Ends at (optional)"), {
      target: { value: "2026-12-01T10:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create offer" }));
    expect(
      await screen.findByText("End date must be after start date."),
    ).toBeInTheDocument();
    expect(createRestaurantVenueOffer).not.toHaveBeenCalled();
  });

  it("submits a mapped create payload and shows a success state", async () => {
    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    await userEvent.click(screen.getByRole("button", { name: "New offer" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "  Weekend deal  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Discount type"), {
      target: { value: "FIXED" },
    });
    fireEvent.change(within(dialog).getByLabelText("Discount value"), {
      target: { value: "30" },
    });
    fireEvent.change(within(dialog).getByLabelText("Promo code (optional)"), {
      target: { value: "  WEEKEND30  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Starts at (optional)"), {
      target: { value: "2026-12-01T10:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Ends at (optional)"), {
      target: { value: "2026-12-05T10:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Terms (optional)"), {
      target: { value: "  Dine-in only  " },
    });
    await userEvent.click(within(dialog).getByRole("switch", { name: "Offer is active" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create offer" }));

    await waitFor(() =>
      expect(createRestaurantVenueOffer).toHaveBeenCalledWith("venue_1", {
        brand: "ghana",
        title: "Weekend deal",
        discountType: "FIXED",
        discountValue: 30,
        promoCode: "WEEKEND30",
        startsAt: new Date("2026-12-01T10:00").toISOString(),
        endsAt: new Date("2026-12-05T10:00").toISOString(),
        isActive: false,
        terms: "Dine-in only",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Offer created.");
  });

  it("edits, toggles and deletes an offer", async () => {
    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    const card = await screen.findByLabelText("Offer Lunch special");
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Lunch special");

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Updated lunch" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateRestaurantVenueOffer).toHaveBeenCalledWith(
        "venue_1",
        "offer_1",
        expect.objectContaining({ title: "Updated lunch" }),
      ),
    );

    await userEvent.click(
      within(card).getByRole("switch", { name: "Active state for Lunch special" }),
    );
    await waitFor(() =>
      expect(updateRestaurantVenueOffer).toHaveBeenCalledWith(
        "venue_1",
        "offer_1",
        expect.objectContaining({ isActive: false }),
      ),
    );

    await userEvent.click(within(card).getByRole("button", { name: "Delete" }));
    const confirmDialog = await screen.findByRole("dialog");
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(deleteRestaurantVenueOffer).toHaveBeenCalledWith("venue_1", "offer_1"),
    );
  });

  it("shows retryable load failures and inline save failures", async () => {
    vi.mocked(listRestaurantVenueOffers).mockRejectedValueOnce(new Error("offline"));

    const { unmount } = renderWithProviders(<RestaurantOffersPage />, {
      initialEntries: [ROUTE],
    });
    expect(await screen.findByText("Failed to load restaurant offers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    unmount();

    vi.mocked(createRestaurantVenueOffer).mockRejectedValueOnce(new Error("invalid"));
    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    await userEvent.click(await screen.findByRole("button", { name: "New offer" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Broken offer" },
    });
    fireEvent.change(within(dialog).getByLabelText("Discount value"), {
      target: { value: "5" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create offer" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Failed to create offer.",
    );
  });

  it("hides offer management controls without the moderate permission", async () => {
    permissionState.canManage = false;

    renderWithProviders(<RestaurantOffersPage />, { initialEntries: [ROUTE] });

    const card = await screen.findByLabelText("Offer Lunch special");
    expect(within(card).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New offer" })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot create, edit, or delete them/i)).toBeInTheDocument();
  });
});
