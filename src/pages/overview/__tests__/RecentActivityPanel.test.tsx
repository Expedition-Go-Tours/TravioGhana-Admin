import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/services/activityService", () => ({
  getActivityFeed: vi.fn(),
}));

import { getActivityFeed } from "@/services/activityService";
import { RecentActivityPanel } from "../RecentActivityPanel";
import type { ActivityFeedPage } from "@/types/activity";

const mockedGetActivityFeed = vi.mocked(getActivityFeed);

function page(overrides: Partial<ActivityFeedPage> = {}): ActivityFeedPage {
  return {
    items: [
      {
        id: "booking:b1:created",
        source: "booking",
        type: "booking",
        action: "booking.created",
        summary: "Ama Mensah booked Cape Coast Castle",
        detail: "TRG-97679268-2026-78 · $90.00",
        actor: { id: "c1", name: "Ama Mensah", role: "customer", photoURL: null },
        object: { type: "booking", id: "b1", label: "TRG-97679268-2026-78" },
        amount: 90,
        currency: "USD",
        href: "/admin/bookings?bookingId=b1",
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: "audit:a1",
        source: "audit",
        type: "system",
        action: "tour.created",
        summary: "Tour created",
        detail: "Cape Coast Castle",
        actor: { id: "a1", name: "Daniel Admin", role: "admin", photoURL: null },
        object: { type: "tour", id: "t1", label: "Cape Coast Castle" },
        href: "/admin/tours/t1",
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
    ],
    hasMore: false,
    nextCursor: null,
    window: "today",
    type: "all",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Radix Select calls the Pointer Events capture API, which jsdom does not
// implement. A no-op shim lets the filter interaction be exercised in tests.
beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: () => false, configurable: true },
    setPointerCapture: { value: () => {}, configurable: true },
    releasePointerCapture: { value: () => {}, configurable: true },
    scrollIntoView: { value: () => {}, configurable: true },
  });
});

describe("RecentActivityPanel", () => {
  beforeEach(() => {
    mockedGetActivityFeed.mockReset();
    mockedGetActivityFeed.mockResolvedValue(page());
  });

  it("renders real summaries, details and an honest count", async () => {
    renderWithProviders(<RecentActivityPanel />);

    expect(await screen.findByText("Ama Mensah booked Cape Coast Castle")).toBeInTheDocument();
    expect(screen.getByText("TRG-97679268-2026-78 · $90.00")).toBeInTheDocument();
    expect(screen.getByText("Tour created")).toBeInTheDocument();
    expect(screen.getByLabelText("2 activities loaded")).toHaveTextContent("2");
    expect(mockedGetActivityFeed).toHaveBeenCalledWith(
      expect.objectContaining({ window: "today", type: "all" }),
    );
  });

  it("switches the window and refetches", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecentActivityPanel />);

    await screen.findByText("Ama Mensah booked Cape Coast Castle");
    await user.click(screen.getByRole("tab", { name: "Yesterday" }));

    await waitFor(() => {
      expect(mockedGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ window: "yesterday", type: "all" }),
      );
    });
  });

  it("filters by activity type", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecentActivityPanel />);

    await screen.findByText("Ama Mensah booked Cape Coast Castle");
    await user.click(screen.getByLabelText("Filter activity by type"));
    await user.click(await screen.findByRole("option", { name: "Bookings" }));

    await waitFor(() => {
      expect(mockedGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ type: "bookings" }),
      );
    });
  });

  it("shows the empty state", async () => {
    mockedGetActivityFeed.mockResolvedValue(page({ items: [], hasMore: false }));

    renderWithProviders(<RecentActivityPanel />);

    expect(await screen.findByText("No activity in this period")).toBeInTheDocument();
  });

  it("shows a retryable error", async () => {
    mockedGetActivityFeed.mockRejectedValue(new Error("network"));

    renderWithProviders(<RecentActivityPanel />);

    expect(await screen.findByText("Failed to load activity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
