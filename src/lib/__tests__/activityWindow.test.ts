import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { windowRange, windowRangeLabel } from "@/lib/activityWindow";

// 19:05 local on Tue 3 Nov 2026. The UTC day may already have rolled over
// depending on the runner's timezone; the point is that the range follows the
// viewer's calendar, not the server's.
const NOW = new Date(2026, 10, 3, 19, 5, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("windowRange", () => {
  it("starts today at the viewer's local midnight, not the UTC one", () => {
    const range = windowRange("today");
    const startOfToday = new Date(2026, 10, 3).getTime();

    expect(new Date(range.from).getTime()).toBe(startOfToday);
    expect(new Date(range.to).getTime()).toBe(NOW.getTime());
  });

  it("bounds yesterday as [midnight yesterday, midnight today)", () => {
    const range = windowRange("yesterday");

    expect(new Date(range.from).getTime()).toBe(new Date(2026, 10, 2).getTime());
    expect(new Date(range.to).getTime()).toBe(new Date(2026, 10, 3).getTime());
  });

  it("rolls the week back six days from the viewer's today", () => {
    const range = windowRange("week");

    expect(new Date(range.from).getTime()).toBe(new Date(2026, 9, 28).getTime());
    expect(new Date(range.to).getTime()).toBe(NOW.getTime());
  });

  it("crosses month and year boundaries correctly", () => {
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    expect(new Date(windowRange("week").from).getTime()).toBe(
      new Date(2026, 11, 26).getTime(),
    );
    expect(new Date(windowRange("yesterday").from).getTime()).toBe(
      new Date(2026, 11, 31).getTime(),
    );
  });
});

describe("windowRangeLabel", () => {
  it("names the single day a one-day window covers", () => {
    const day = new Date(windowRange("today").from).getDate();
    expect(windowRangeLabel("today")).toContain(String(day));
  });

  it("shows both ends of the week", () => {
    const label = windowRangeLabel("week");
    expect(label).toContain("–");
    expect(label).toContain(String(new Date(2026, 9, 28).getDate()));
  });
});
