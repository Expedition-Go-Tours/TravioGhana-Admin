import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/axios", () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

import api from "@/lib/axios";
import {
  getRestaurantClaimErrorMessage,
  getRestaurantClaimErrorStatus,
  listPendingRestaurantClaims,
  resolveRestaurantClaim,
} from "@/services/restaurantClaimService";
import type { RestaurantClaim } from "@/services/restaurantClaimService";

const claim = {
  id: "claim_1",
  venueId: "venue_1",
  userId: "user_1",
  brand: "ghana",
  status: "PENDING",
  contactEmail: "owner@example.com",
} as RestaurantClaim;

const listData = {
  claims: [claim],
  pagination: { limit: 20, hasMore: true, nextCursor: "cursor_2" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("restaurantClaimService", () => {
  it("lists pending claims through the shared admin route", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: "success", data: listData } });

    await expect(listPendingRestaurantClaims()).resolves.toEqual(listData);
    expect(api.get).toHaveBeenCalledWith("/admin/restaurant-venues/claims/pending", {
      params: { limit: 20 },
      signal: undefined,
    });
  });

  it("forwards a cursor when loading another page", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: listData } });

    await listPendingRestaurantClaims({ limit: 10, cursor: "cursor_1" });

    expect(api.get).toHaveBeenCalledWith("/admin/restaurant-venues/claims/pending", {
      params: { limit: 10, cursor: "cursor_1" },
      signal: undefined,
    });
  });

  it("resolves a claim with a trimmed optional note", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { claim } } });

    await expect(
      resolveRestaurantClaim({ claimId: "claim 1", action: "approve", note: "  verified  " }),
    ).resolves.toEqual(claim);
    expect(api.patch).toHaveBeenCalledWith(
      "/admin/restaurant-venues/claims/claim%201",
      { action: "approve", note: "verified" },
      { skipGlobalErrorHandler: true },
    );
  });

  it("omits an empty note from the decision body", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { claim } } });

    await resolveRestaurantClaim({ claimId: "claim_1", action: "reject", note: "   " });

    expect(api.patch).toHaveBeenCalledWith(
      "/admin/restaurant-venues/claims/claim_1",
      { action: "reject" },
      { skipGlobalErrorHandler: true },
    );
  });

  it("surfaces the server message and status of a failed decision", () => {
    const error = {
      message: "Request failed",
      response: { status: 409, data: { message: "This claim has already been reviewed" } },
    };

    expect(getRestaurantClaimErrorMessage(error, "Fallback")).toBe(
      "This claim has already been reviewed",
    );
    expect(getRestaurantClaimErrorMessage({}, "Fallback")).toBe("Fallback");
    expect(getRestaurantClaimErrorStatus(error)).toBe(409);
  });
});
