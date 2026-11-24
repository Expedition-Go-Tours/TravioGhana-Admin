import { describe, expect, it } from "vitest";
import type { AxiosAdapter } from "axios";
import api, { resolveApiUrl } from "@/lib/axios";

describe("resolveApiUrl", () => {
  it("leaves shared restaurant venue claim routes unchanged", () => {
    expect(resolveApiUrl("/admin/restaurant-venues/claims/pending")).toBe(
      "/admin/restaurant-venues/claims/pending",
    );
    expect(resolveApiUrl("/admin/restaurant-venues/claims/claim_1")).toBe(
      "/admin/restaurant-venues/claims/claim_1",
    );
    expect(resolveApiUrl("/admin/restaurant-venues/venue_1/reviews/pending")).toBe(
      "/admin/restaurant-venues/venue_1/reviews/pending",
    );
  });

  it("still brands every other admin route", () => {
    const rewrites: Array<[string, string]> = [
      ["/admin/cancellation-requests", "/travioghana/admin/cancellation-requests"],
      ["/admin/reviews/pending", "/travioghana/admin/reviews/pending"],
      // The exact prefix without a trailing slash is not a claims route.
      ["/admin/restaurant-venues", "/travioghana/admin/restaurant-venues"],
    ];

    for (const [input, expected] of rewrites) {
      expect(resolveApiUrl(input), input).toBe(expected);
    }
  });

  it("preserves the existing shared and branded route rules", () => {
    const rewrites: Array<[string, string]> = [
      ["/auth/login", "/auth/login"],
      ["/blog/posts", "/blog/posts"],
      ["/reviews/admin/pending", "/travioghana/admin/reviews/pending"],
      ["/reviews/rev_1/moderate", "/travioghana/admin/reviews/rev_1/moderate"],
      ["/suppliers/admin/applications", "/travioghana/admin/suppliers/applications"],
      ["/payouts/admin/requests", "/travioghana/admin/payouts/requests"],
      ["/payout-methods/admin", "/travioghana/admin/payout-methods"],
      ["/notifications", "/travioghana/admin/notifications"],
      ["/chat/conversations", "/travioghana/admin/chat/conversations"],
      ["/tours/tour_1", "/travioghana/admin/tours/tour_1"],
      ["/tours/filters/options", "/tours/filters/options"],
    ];

    for (const [input, expected] of rewrites) {
      expect(resolveApiUrl(input), input).toBe(expected);
    }
  });
});

describe("api request interceptor", () => {
  it("sends claims requests to the shared path", async () => {
    let sentUrl = "";
    const adapter: AxiosAdapter = async (config) => {
      sentUrl = config.url || "";
      return { data: { status: "success" }, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/admin/restaurant-venues/claims/pending", { adapter });

    expect(sentUrl).toContain("/admin/restaurant-venues/claims/pending");
    expect(sentUrl).not.toContain("travioghana");
  });

  it("still brands other admin requests on the wire", async () => {
    let sentUrl = "";
    const adapter: AxiosAdapter = async (config) => {
      sentUrl = config.url || "";
      return { data: { status: "success" }, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/admin/cancellation-requests", { adapter });

    expect(sentUrl).toContain("/travioghana/admin/cancellation-requests");
  });
});
