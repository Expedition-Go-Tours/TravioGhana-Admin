import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { PayoutSchedulesTab } from "../PayoutSchedulesTab";

/**
 * The schedules list is a triage view: forty suppliers, almost all of them
 * with nothing to pay. The two things that made it useful rather than a
 * column of zeros were the row expansion and the reason rendered in place of
 * the zero — both are exercised here, because neither shows up in a type
 * check.
 */

vi.mock("@/lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("@/lib/adminSocket", () => ({
  getAdminSocket: () => ({ on: () => {}, off: () => {} }),
}));

import api from "@/lib/axios";

const apiGet = vi.mocked(api.get);

const basePlan = {
  autoManaged: true,
  cycle: "WEEKLY",
  scheduleLabel: "Every week — paid every Monday",
  scheduleShortLabel: "Weekly",
  nextRunAt: new Date(2026, 9, 5).toISOString(),
  nextRunPeriodLabel: "Sep 28 – Oct 4",
  lastRunAt: new Date(2026, 8, 28).toISOString(),
  effectiveAt: null,
  pendingCycle: null,
  pendingEffectiveAt: null,
  defaultCycle: "TWICE_MONTHLY",
  autoRunsEnabled: true,
};

const READY = { code: "READY", label: "Ready to run", detail: "Funds cleared.", kind: "ready" };
const NO_METHOD = {
  code: "NO_METHOD",
  label: "No verified payout method",
  detail: "The run skips suppliers with no verified destination for the money.",
  kind: "blocked",
};

const ROWS = [
  {
    supplierId: "u-rich",
    name: "Expedition-Go Tours LTD",
    email: "expedition@example.com",
    status: "ACTIVE",
    plan: basePlan,
    eligibleBalance: { amount: 811.91, bookingCount: 2, currency: "USD" },
    hasVerifiedMethod: true,
    readiness: READY,
  },
  {
    supplierId: "u-empty",
    name: "VISIT KAKUM",
    email: "kakum@example.com",
    status: "ACTIVE",
    plan: basePlan,
    eligibleBalance: { amount: 0, bookingCount: 0, currency: "USD" },
    hasVerifiedMethod: false,
    readiness: NO_METHOD,
  },
];

const DETAIL = {
  supplierId: "u-rich",
  period: { start: new Date(2026, 8, 28).toISOString(), end: new Date(2026, 9, 4, 23, 59, 59, 999).toISOString(), label: "Sep 28 – Oct 4" },
  eligibleBalance: { amount: 811.91, bookingCount: 2, currency: "USD" },
  hasVerifiedMethod: true,
  readiness: READY,
  straddlesPeriod: true,
  bookings: [
    {
      id: "b-in",
      bookingNumber: "GHA-33723361-2026-01",
      tourTitle: "Cape Coast Castle & Kakum National Park Tour",
      travelDate: new Date(2026, 8, 30).toISOString(),
      supplierPayout: 760.91,
      currency: "USD",
      status: "COMPLETED",
      paymentStatus: "SUCCEEDED",
      clearedAt: new Date(2026, 9, 1).toISOString(),
      inPeriod: true,
    },
    {
      id: "b-out",
      bookingNumber: "GHA-35795466-2026-02",
      tourTitle: "The Ghana Naming Ceremony Tour",
      travelDate: new Date(2026, 8, 10).toISOString(),
      supplierPayout: 51,
      currency: "USD",
      status: "CONFIRMED",
      paymentStatus: "SUCCEEDED",
      clearedAt: new Date(2026, 8, 20).toISOString(),
      inPeriod: false,
    },
  ],
};

function mockApi() {
  apiGet.mockImplementation((url: string) => {
    if (String(url).includes("eligible-bookings")) {
      return Promise.resolve({ data: { data: DETAIL } }) as never;
    }
    return Promise.resolve({
      data: {
        data: {
          schedules: ROWS,
          pagination: { currentPage: 1, limit: 20, totalCount: 2, totalPages: 1 },
          cycles: [],
          summary: { enrolled: 2, byCycle: {}, pendingChanges: 0, missingVerifiedMethod: 1, runsNext7Days: 1 },
          autoRunsEnabled: true,
          defaultCycle: "TWICE_MONTHLY",
        },
      },
    }) as never;
  });
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe("PayoutSchedulesTab — reading a zero", () => {
  it("shows why the amount is zero instead of repeating '0 bookings'", async () => {
    renderWithProviders(<PayoutSchedulesTab />);

    expect(await screen.findByText("Expedition-Go Tours LTD")).toBeInTheDocument();
    // The reason travels with the zero — otherwise this column is forty
    // identical "$0.00 / 0 bookings".
    expect(screen.getByText("No verified payout method")).toBeInTheDocument();
    expect(screen.queryByText(/0 bookings/)).not.toBeInTheDocument();
  });

  it("still shows the figure and the count for a supplier with money", async () => {
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    expect(screen.getByText("$811.91")).toBeInTheDocument();
    expect(screen.getByText("2 bookings")).toBeInTheDocument();
  });
});

describe("PayoutSchedulesTab — row expansion", () => {
  it("expands on click and loads the bookings behind the figure", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    await user.click(rowOf("Expedition-Go Tours LTD"));

    // Lazily fetched for this supplier only.
    expect(apiGet).toHaveBeenCalledWith("/admin/finance/payout-schedules/u-rich/eligible-bookings");

    const table = await screen.findByRole("table", { name: /bookings ready for this supplier/i });
    expect(within(table).getByText("GHA-33723361-2026-01")).toBeInTheDocument();
    expect(within(table).getByText(/Cape Coast Castle/)).toBeInTheDocument();
    // The total in the panel must equal the total in the row above it.
    expect(within(table).getByText("$811.91")).toBeInTheDocument();
  });

  it("keeps one row open at a time", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    await user.click(rowOf("Expedition-Go Tours LTD"));
    await screen.findByRole("table", { name: /bookings ready for this supplier/i });

    // Second supplier opens; the first closes rather than stacking.
    await user.click(rowOf("VISIT KAKUM"));
    expect(screen.queryByRole("table", { name: /bookings ready for this supplier/i })).not.toBeInTheDocument();
    // ...because an empty pot has nothing to itemise, and the reason says so.
    expect(screen.getByText(/nothing to show yet/i)).toBeInTheDocument();
  });

  it("does not fetch line items for a supplier with an empty pot", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    await user.click(rowOf("VISIT KAKUM"));
    expect(screen.getByText(/nothing to show yet/i)).toBeInTheDocument();

    expect(apiGet).not.toHaveBeenCalledWith("/admin/finance/payout-schedules/u-empty/eligible-bookings");
  });

  it("collapses when the same row is clicked again", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    const row = rowOf("Expedition-Go Tours LTD");
    await user.click(row);
    await screen.findByRole("table", { name: /bookings ready for this supplier/i });

    await user.click(rowOf("Expedition-Go Tours LTD"));
    expect(screen.queryByRole("table", { name: /bookings ready for this supplier/i })).not.toBeInTheDocument();
  });

  it("announces the disclosure state to assistive technology", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    const row = rowOf("Expedition-Go Tours LTD");
    expect(row).toHaveAttribute("aria-expanded", "false");

    await user.click(row);
    expect(rowOf("Expedition-Go Tours LTD")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("VISIT KAKUM")).toHaveAttribute("aria-expanded", "false");
  });

  it("marks a booking that travelled outside the labelled window", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PayoutSchedulesTab />);
    await screen.findByText("Expedition-Go Tours LTD");

    await user.click(rowOf("Expedition-Go Tours LTD"));
    await screen.findByRole("table", { name: /bookings ready for this supplier/i });

    // The figure is "cleared so far"; the label is the run. When they differ
    // the expansion says so rather than letting the mismatch be implied.
    expect(screen.getByText(/travelled before the/i)).toBeInTheDocument();
  });
});
