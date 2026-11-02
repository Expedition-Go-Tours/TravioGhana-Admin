import { describe, expect, it } from "vitest";
import { getNavGroups } from "@/components/layout/navConfig";

const allowAll = () => true;

describe("getNavGroups", () => {
  it("keeps the production group order and a unique path per destination", () => {
    const groups = getNavGroups(allowAll);

    expect(groups.map((group) => group.group)).toEqual([
      "Overview",
      "Operations",
      "Catalog",
      "Insights",
      "Engagement",
      "Finance",
      "System",
    ]);

    const paths = groups.flatMap((group) => group.items.map((item) => item.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps operational queues together and badges only on actionable rows", () => {
    const operations = getNavGroups(allowAll).find((group) => group.group === "Operations");

    expect(operations?.items.map((item) => item.label)).toEqual([
      "Bookings",
      "Cancellations",
      "Refund requests",
      "Suppliers",
      "Quality Control",
    ]);
    expect(operations?.items.filter((item) => item.badgeKey).map((item) => item.label)).toEqual([
      "Bookings",
      "Cancellations",
    ]);
  });

  it("drops groups the viewer cannot see", () => {
    const groups = getNavGroups((key) => key === "bookings.view");

    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe("Operations");
    expect(groups[0].items.map((item) => item.label)).toEqual([
      "Bookings",
      "Cancellations",
      "Refund requests",
    ]);
  });

  it("moves messages into Engagement instead of scattering them", () => {
    const engagement = getNavGroups(allowAll).find((group) => group.group === "Engagement");

    expect(engagement?.items.map((item) => item.label)).toEqual([
      "Reviews",
      "Blog",
      "Customer Support",
      "Supplier Messages",
      "Notifications",
    ]);
  });
});
