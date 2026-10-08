import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";

const { notificationListeners, connectListeners } = vi.hoisted(() => ({
  notificationListeners: [] as Array<() => void>,
  connectListeners: [] as Array<() => void>,
}));

vi.mock("@/services/notificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/notificationService")>();
  return {
    ...actual,
    getNotifications: vi.fn(),
    getNotificationStats: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    invalidateNotificationQueries: vi.fn(),
  };
});

vi.mock("@/lib/adminSocket", () => ({
  getAdminSocket: vi.fn(),
  onAdminNotification: (cb: () => void) => {
    notificationListeners.push(cb);
    return () => undefined;
  },
  onAdminSocketConnect: (cb: () => void) => {
    connectListeners.push(cb);
    return () => undefined;
  },
}));

import NotificationsPage from "@/pages/notifications/NotificationsPage";
import {
  getNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  invalidateNotificationQueries,
} from "@/services/notificationService";
import { renderWithProviders } from "@/test/test-utils";

// ── Fixtures ───────────────────────────────────────────────────────────────

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const baseNotification = {
  storefront: "ghana",
  readAt: null,
  data: {} as Record<string, unknown>,
};

const feed = {
  notifications: [
    {
      ...baseNotification,
      id: "n1",
      type: "PAYOUT_NEEDS_APPROVAL",
      title: "Payout needs approval",
      message: "Kwame Tours requested GHC 4,200.",
      data: { payoutId: "p1" },
      read: false,
      createdAt: hoursAgo(0.5),
    },
    {
      ...baseNotification,
      id: "n2",
      type: "NEW_SUPPLIER_APPLICATION",
      title: "New supplier application",
      message: "Safari Lines applied to join.",
      data: { supplierId: "s1" },
      read: false,
      createdAt: hoursAgo(2),
    },
    {
      ...baseNotification,
      id: "n3",
      type: "SYSTEM_ALERT",
      title: "Scheduled maintenance",
      message: "The platform will be read-only for 20 minutes.",
      read: true,
      readAt: hoursAgo(3),
      createdAt: hoursAgo(30),
    },
  ],
  pagination: { currentPage: 1, totalPages: 3, totalCount: 45, unreadCount: 2, limit: 20 },
};

const stats = {
  total: 1204,
  unacknowledged: 12,
  byType: [
    { type: "BOOKING_CREATED", _count: 300 },
    { type: "PAYOUT_NEEDS_APPROVAL", _count: 4 },
    { type: "NEW_SUPPLIER_APPLICATION", _count: 4 },
    { type: "REVIEW_NEEDS_MODERATION", _count: 40 },
    { type: "SYSTEM_ALERT", _count: 2 },
    { type: "NEW_MESSAGE", _count: 61 },
  ],
  recent: [],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

const renderPage = (initialEntries: string[] = ["/admin/notifications"]) =>
  renderWithProviders(
    <>
      <NotificationsPage />
      <LocationProbe />
    </>,
    { initialEntries },
  );

const lastFeedCall = () => {
  const calls = vi.mocked(getNotifications).mock.calls;
  const call = calls[calls.length - 1];
  if (!call) throw new Error("getNotifications was never called");
  // The parameter is optional in the signature, so it types as nullable.
  return call[0] ?? {};
};

const notificationRail = () =>
  within(screen.getByRole("navigation", { name: "Notification filters" }));

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  notificationListeners.length = 0;
  connectListeners.length = 0;
  vi.mocked(getNotifications).mockResolvedValue(feed);
  vi.mocked(getNotificationStats).mockResolvedValue(stats);
  vi.mocked(markAsRead).mockResolvedValue(undefined);
  vi.mocked(markAllAsRead).mockResolvedValue(undefined);
});

describe("NotificationsPage", () => {
  it("renders the feed grouped by day", async () => {
    renderPage();

    expect(await screen.findByText("Payout needs approval")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yesterday" })).toBeInTheDocument();
    // Three fixture rows survive the grouping.
    expect(screen.getByText("New supplier application")).toBeInTheDocument();
    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
  });

  it("offers a mark-as-read control only on unread rows", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    expect(
      screen.getByRole("button", { name: 'Mark "Payout needs approval" as read' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: 'Mark "Scheduled maintenance" as read' }),
    ).not.toBeInTheDocument();
  });

  it("states its brand scope and summarises the counts", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    expect(screen.getByText("Travio Ghana")).toBeInTheDocument();
    expect(screen.getByText("1,204 total · 12 unread · 48 need action")).toBeInTheDocument();
  });

  it("does not repeat a brand label on every row of its own-brand feed", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    // The header chip is the only "Travio Ghana" on the page: rows from this
    // dashboard's own storefront are not annotated.
    expect(screen.getAllByText("Travio Ghana")).toHaveLength(1);
    expect(screen.queryByText("Platform-wide")).not.toBeInTheDocument();
  });

  it("labels a row that comes from another storefront", async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      ...feed,
      notifications: [{ ...feed.notifications[0], storefront: null }],
    });

    renderPage();

    expect(await screen.findByText("Platform-wide")).toBeInTheDocument();
  });

  it("requests only the selected category's types", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    vi.mocked(getNotifications).mockClear();

    await userEvent.click(notificationRail().getByRole("button", { name: /Needs action/ }));

    const types: readonly string[] | undefined = lastFeedCall().types;
    expect(types).toBeDefined();
    expect(types).toEqual(
      expect.arrayContaining([
        "NEW_SUPPLIER_APPLICATION",
        "PAYOUT_NEEDS_APPROVAL",
        "REVIEW_NEEDS_MODERATION",
      ]),
    );
    // A validated filter key never resolves to an empty list, which the client
    // would otherwise read as "no filter" and silently return everything.
    expect(types!.length).toBeGreaterThan(0);
  });

  it("restricts the feed to unread when the toggle is on", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    vi.mocked(getNotifications).mockClear();

    await userEvent.click(notificationRail().getByRole("checkbox", { name: /Unread only/ }));

    expect(lastFeedCall().unreadOnly).toBe(true);
    expect(screen.getByTestId("location")).toHaveTextContent("unread=1");
  });

  it("reflects filter state in the URL so a view is shareable", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    await userEvent.click(
      notificationRail().getByRole("button", { name: /Payments & payouts/ }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent("filter=payments");
    expect(screen.getByTestId("location").textContent).not.toContain("page=");
  });

  it("restores a view from the URL", async () => {
    renderPage(["/admin/notifications?filter=system&unread=1&q=maintenance"]);

    await screen.findByText("Scheduled maintenance");
    expect(lastFeedCall().types).toEqual([
      "SYSTEM_ALERT",
      "STRIPE_CUSTOMER_CREATE_FAILED",
    ]);
    expect(lastFeedCall().unreadOnly).toBe(true);
    expect(lastFeedCall().search).toBe("maintenance");
    expect(
      notificationRail().getByRole("checkbox", { name: /Unread only/ }),
    ).toBeChecked();
  });

  it("debounces typing into the query rather than firing per keystroke", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    const before = vi.mocked(getNotifications).mock.calls.length;

    await userEvent.type(screen.getByRole("searchbox", { name: "Search notifications" }), "payout");

    await waitFor(
      () => {
        expect(lastFeedCall().search).toBe("payout");
        expect(screen.getByTestId("location")).toHaveTextContent("q=payout");
      },
      { timeout: 2500 },
    );

    // Two characters typed, but at most one extra request: the debounce holds.
    expect(vi.mocked(getNotifications).mock.calls.length).toBeLessThanOrEqual(before + 2);
  });

  it("marks a single row as read without opening it", async () => {
    renderPage();

    await screen.findByText("Scheduled maintenance");
    const probeBefore = screen.getByTestId("location").textContent;

    await userEvent.click(
      screen.getByRole("button", { name: 'Mark "Payout needs approval" as read' }),
    );

    // React Query passes a context object as the second mutation argument.
    expect(vi.mocked(markAsRead).mock.calls[0][0]).toBe("n1");
    expect(screen.getByTestId("location").textContent).toBe(probeBefore);
  });

  it("navigates to the notification's destination when a row is opened", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    await userEvent.click(screen.getByText("Payout needs approval"));

    expect(screen.getByTestId("location")).toHaveTextContent("/admin/payouts");
    expect(vi.mocked(markAsRead).mock.calls[0][0]).toBe("n1");
  });

  it("marks everything as read in one action", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    await userEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(invalidateNotificationQueries).toHaveBeenCalled());
  });

  it("shows a caught-up state when the feed is genuinely empty", async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [],
      pagination: { currentPage: 1, totalPages: 0, totalCount: 0, unreadCount: 0, limit: 20 },
    });

    renderPage();

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByText("Nothing new on Travio Ghana right now.")).toBeInTheDocument();
  });

  it("offers a way out when a filter returns nothing", async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [],
      pagination: { currentPage: 1, totalPages: 0, totalCount: 0, unreadCount: 0, limit: 20 },
    });

    renderPage(["/admin/notifications?filter=messages"]);

    expect(await screen.findByText("No notifications match these filters")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /Clear filters/ })[0]);
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/notifications");
  });

  it("recovers from a failed load", async () => {
    vi.mocked(getNotifications).mockRejectedValueOnce(new Error("boom"));

    renderPage();

    expect(await screen.findByText("Couldn't load notifications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Payout needs approval");
    expect(vi.mocked(getNotifications).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("holds its position when new notifications arrive, then applies them on request", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    const before = vi.mocked(getNotifications).mock.calls.length;

    // A notification lands on the socket. The connect listener is not fired
    // here: reconnect deliberately resets the pill, since it refreshes instead.
    for (const listener of notificationListeners) listener();

    const pill = await screen.findByRole("button", { name: /1 new notification/ });
    // The list did not re-sort under the reader.
    expect(vi.mocked(getNotifications).mock.calls.length).toBe(before);

    await userEvent.click(pill);
    await waitFor(() => expect(invalidateNotificationQueries).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /new notification/ })).not.toBeInTheDocument();
  });

  it("handles a plural arrival count", async () => {
    renderPage();
    await screen.findByText("Payout needs approval");

    for (const listener of notificationListeners) {
      listener();
      listener();
    }

    expect(
      await screen.findByRole("button", { name: /2 new notifications/ }),
    ).toBeInTheDocument();
  });

  it("paginates through the server-side result", async () => {
    renderPage();

    await screen.findByText("Payout needs approval");
    // The range line wraps its numbers in spans, so match on the paragraph's
    // own text node.
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 1–20 of 45");

    await userEvent.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByTestId("location")).toHaveTextContent("page=2");
    expect(lastFeedCall().page).toBe(2);
  });

  it("hides rail counts until statistics arrive rather than showing zeroes", () => {
    vi.mocked(getNotificationStats).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.queryByText("1,204")).not.toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });
});
