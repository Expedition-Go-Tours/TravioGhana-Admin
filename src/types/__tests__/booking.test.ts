import { describe, expect, it } from "vitest";
import { travelerCategories, travelerCount, type TravelerData } from "../booking";

function travelers(overrides: Record<string, unknown> = {}): TravelerData {
  return { adults: 0, children: 0, infants: 0, ...overrides };
}

describe("travelerCategories", () => {
  it("renders every numeric category in a stable order", () => {
    const categories = travelerCategories(travelers({
      adults: 1,
      seniors: 2,
      students: 1,
    }));

    expect(categories.map(({ key, count }) => ({ key, count }))).toEqual([
      { key: "adults", count: 1 },
      { key: "seniors", count: 2 },
      { key: "students", count: 1 },
    ]);
  });

  it("ignores contact metadata and named detail rows", () => {
    const categories = travelerCategories(travelers({
      adults: 1,
      phoneNumber: "233201234567",
      location: "Accra",
      details: [{ name: "Ama", ageGroup: "adult" }],
    }));

    expect(categories).toEqual([
      { key: "adults", count: 1, singular: "Adult", plural: "Adults" },
    ]);
  });

  it("handles malformed input", () => {
    expect(travelerCategories(null)).toEqual([]);
    expect(travelerCategories(undefined)).toEqual([]);
  });
});

describe("travelerCount", () => {
  it("sums supplier-defined categories", () => {
    expect(travelerCount(travelers({
      adults: 1,
      seniors: 2,
      students: 1,
      youth: 1,
    }))).toBe(5);
  });
});
