import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

const permissionState = vi.hoisted(() => ({ canModerate: true }));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: (key: string) => (key === "reviews.moderate" ? permissionState.canModerate : true),
    isSuperAdmin: permissionState.canModerate,
    adminRole: { id: "role_1", name: "reviewer", permissions: ["reviews.view"] },
    loading: false,
    setAdminRole: () => {},
  }),
}));

vi.mock("@/services/restaurantClaimService", () => ({
  RESTAURANT_CLAIMS_QUERY_KEY: ["admin", "restaurant-claims"],
  listPendingRestaurantClaims: vi.fn(),
  resolveRestaurantClaim: vi.fn(),
  getRestaurantClaimErrorMessage: (_error: unknown, fallback: string) => fallback,
  getRestaurantClaimErrorStatus: () => undefined,
}));

import {
  listPendingRestaurantClaims,
  resolveRestaurantClaim,
} from "@/services/restaurantClaimService";
import type { RestaurantClaim } from "@/services/restaurantClaimService";
import RestaurantClaimsPage from "../RestaurantClaimsPage";

const claim = {
  id: "claim_1",
  venueId: "venue_1",
  userId: "user_1",
  brand: "ghana",
  businessName: "Cape Coast Eats",
  role: "Operations manager",
  contactEmail: "owner@example.com",
  phone: "+233 24 000 0000",
  message: "I manage bookings for this restaurant and can provide receipts.",
  evidenceUrl: "https://example.com/evidence.pdf",
  status: "PENDING",
  reviewNote: null,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  venueName: "Cape Coast Castle Kitchen",
  venueSlug: "cape-coast-castle-kitchen",
  venueCity: "Cape Coast",
  claimantName: "Ama Mensah",
  claimantEmail: "ama@example.com",
} as RestaurantClaim;

const secondClaim = {
  ...claim,
  id: "claim_2",
  venueName: "Accra Riverside Restaurant",
  claimantName: "Kofi Boateng",
} as RestaurantClaim;

const listResponse = {
  claims: [claim],
  pagination: { limit: 20, hasMore: false, nextCursor: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  permissionState.canModerate = true;
  vi.mocked(listPendingRestaurantClaims).mockResolvedValue(listResponse);
  vi.mocked(resolveRestaurantClaim).mockResolvedValue({ ...claim, status: "APPROVED" });
});

describe("RestaurantClaimsPage", () => {
  it("renders the pending queue with venue, claimant and evidence details", async () => {
    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });

    const card = await screen.findByLabelText("Claim for Cape Coast Castle Kitchen");
    expect(within(card).getByText("Cape Coast Castle Kitchen")).toBeInTheDocument();
    expect(within(card).getByText("Travio Ghana")).toBeInTheDocument();
    expect(within(card).getByText("Cape Coast")).toBeInTheDocument();
    expect(within(card).getByText("Ama Mensah")).toBeInTheDocument();
    expect(within(card).getByText("owner@example.com")).toBeInTheDocument();
    expect(within(card).getByText("Cape Coast Eats")).toBeInTheDocument();
    expect(within(card).getByText("Role: Operations manager")).toBeInTheDocument();
    expect(within(card).getByText(/I manage bookings for this restaurant/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View evidence" })).toHaveAttribute(
      "href",
      "https://example.com/evidence.pdf",
    );
    expect(within(card).getByText("PENDING")).toBeInTheDocument();
  });

  it("highlights and scrolls to the claim named in a notification deep link", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims?claimId=claim_1"],
    });

    const card = await screen.findByLabelText("Claim for Cape Coast Castle Kitchen");
    expect(card.id).toBe("restaurant-claim-claim_1");
    expect(card).toHaveClass("border-primary");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it("approves a claim with an optional admin note", async () => {
    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });

    const card = await screen.findByLabelText("Claim for Cape Coast Castle Kitchen");
    await userEvent.click(within(card).getByRole("button", { name: "Approve" }));

    const dialog = await screen.findByRole("dialog");
    const noteField = within(dialog).getByLabelText(/admin note/i);
    await userEvent.type(noteField, "Verified with owner records");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve claim" }));

    await waitFor(() => {
      expect(resolveRestaurantClaim).toHaveBeenCalledWith(
        {
          claimId: "claim_1",
          action: "approve",
          note: "Verified with owner records",
        },
        expect.objectContaining({ client: expect.anything() }),
      );
    });
    await waitFor(() => expect(listPendingRestaurantClaims).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Claim approved/)).toBeInTheDocument();
  });

  it("hides decision buttons without the moderate permission", async () => {
    permissionState.canModerate = false;

    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });

    const card = await screen.findByLabelText("Claim for Cape Coast Castle Kitchen");
    expect(within(card).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot approve or reject them/i)).toBeInTheDocument();
  });

  it("loads the next cursor page on demand", async () => {
    vi.mocked(listPendingRestaurantClaims)
      .mockResolvedValueOnce({
        claims: [claim],
        pagination: { limit: 1, hasMore: true, nextCursor: "cursor_2" },
      })
      .mockResolvedValueOnce({
        claims: [secondClaim],
        pagination: { limit: 1, hasMore: false, nextCursor: null },
      });

    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });

    await screen.findByLabelText("Claim for Cape Coast Castle Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await screen.findByLabelText("Claim for Accra Riverside Restaurant");
    expect(listPendingRestaurantClaims).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "cursor_2" }),
    );
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("shows an empty state and a retryable error state", async () => {
    vi.mocked(listPendingRestaurantClaims).mockResolvedValueOnce({
      claims: [],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    });

    const { unmount } = renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });
    expect(await screen.findByText("No pending claims")).toBeInTheDocument();
    unmount();

    vi.mocked(listPendingRestaurantClaims).mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(<RestaurantClaimsPage />, {
      initialEntries: ["/admin/restaurant-claims"],
    });
    expect(await screen.findByText("Failed to load restaurant claims")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
