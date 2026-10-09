import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import UserGrowthPage from "../UserGrowth";
import {
  parseBucket,
  formatAxisLabel,
  formatTooltipLabel,
  buildGrowthCsv,
  type GrowthRow,
} from "../userGrowthFormat";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const GROWTH: GrowthRow[] = [
  { month: "2026-10", total: 10, customers: 8, suppliers: 2 },
  { month: "2026-11", total: 12, customers: 9, suppliers: 3 },
];
const PREVIOUS: GrowthRow[] = [
  { month: "2025-10", total: 5, customers: 4, suppliers: 1 },
  { month: "2025-11", total: 5, customers: 4, suppliers: 1 },
];

function mockApi() {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith("/admin/analytics/user-growth")) {
      return Promise.resolve({
        data: {
          status: "success",
          data: { growth: GROWTH, previous: PREVIOUS, granularity: "month", period: "1y" },
        },
      });
    }
    if (url.startsWith("/admin/users/new")) {
      return Promise.resolve({
        data: {
          status: "success",
          data: {
            users: [
              { id: "u1", name: "Ama", email: "ama@example.com", roles: ["customer"], createdAt: "2026-11-05T10:00:00Z", phone: "+233 20 000 1111", hasBookings: true },
              { id: "u2", name: "Kofi", email: "kofi@example.com", roles: ["customer"], createdAt: "2026-11-06T10:00:00Z", phone: null, hasBookings: false },
              { id: "u3", name: "Esi", email: "esi@example.com", roles: ["customer"], createdAt: "2026-11-07T10:00:00Z", phone: "+233 30 000 2222", hasBookings: false },
            ],
          },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

describe("UserGrowthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it("renders card totals from real growth data plus explicit previous-period deltas", async () => {
    renderWithProviders(<UserGrowthPage />);

    await waitFor(() => expect(screen.getByText("Total New Users")).toBeInTheDocument());
    // Period totals: 22 total / 17 customers / 5 suppliers; avg 11 over 2 months.
    expect(await screen.findByText("22")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();

    // Every delta caps at +100% and states its comparison window.
    expect(screen.getAllByText("+100.0%")).toHaveLength(3);
    expect(screen.getAllByText("vs prev. 12 months").length).toBeGreaterThanOrEqual(3);

    // Latest bucket context (Nov '26 = 12 total) and dynamic avg label.
    expect(screen.getByText("12 in November 2026")).toBeInTheDocument();
    expect(screen.getByText("Avg / Month")).toBeInTheDocument();

    // Chart card: stacked legend + window pill.
    expect(screen.getByText("Registration Trend")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Total: 22 · last 12 months")).toBeInTheDocument();

    // Comparison overlay + export controls.
    expect(screen.getByRole("button", { name: "Previous period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
  });

  it("shows phone numbers for booked customers in the drill-down, hides them otherwise", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserGrowthPage />);

    await user.click(await screen.findByText("Total New Users"));

    expect(await screen.findByText("New Users")).toBeInTheDocument();
    // Booked customer -> phone shown.
    expect(await screen.findByText("+233 20 000 1111")).toBeInTheDocument();
    // Unbooked customer with a profile phone -> phone hidden.
    expect(screen.queryByText("+233 30 000 2222")).not.toBeInTheDocument();
    // The drill-down request includes the period but no role for "all".
    expect(mockGet).toHaveBeenCalledWith("/admin/users/new?period=1y");
  });

  it("scopes the drill-down to role + bucket when opened from a bar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserGrowthPage />);

    await user.click(await screen.findByText("New Customers"));

    // The dialog title duplicates the card label — assert on the dialog
    // description (unique) instead.
    expect(await screen.findByText(/users registered in the selected period \(customers\)/)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("/admin/users/new?period=1y&role=customer");
  });
});

describe("bucket formatters (Invalid Date guard)", () => {
  it("parses YYYY-MM and YYYY-MM-DD labels into stable local dates", () => {
    expect(parseBucket("2026-10")).toEqual(new Date(2026, 9, 1));
    expect(parseBucket("2026-10-05")).toEqual(new Date(2026, 9, 5));
  });

  it("rejects ISO timestamps and garbage instead of producing Invalid Date", () => {
    expect(parseBucket("2026-10-05T00:00:00.000Z")).toBeNull();
    expect(parseBucket("Invalid Date")).toBeNull();
    expect(parseBucket(undefined)).toBeNull();
  });

  it("formats axis labels per granularity", () => {
    expect(formatAxisLabel("2026-10", "month")).toContain("Oct");
    expect(formatAxisLabel("2026-10-05", "day")).toBe("Oct 5");
    expect(formatAxisLabel("2026-10-05", "week")).toBe("Oct 5");
    expect(formatAxisLabel("garbage", "month")).toBe("garbage");
  });

  it("formats tooltip labels per granularity", () => {
    expect(formatTooltipLabel("2026-10", "month")).toBe("October 2026");
    expect(formatTooltipLabel("2026-10-05", "day")).toBe("Oct 5, 2026");
  });

  it("builds a CSV of the growth series", () => {
    const csv = buildGrowthCsv(GROWTH);
    expect(csv).toBe(
      "Bucket,Total,Customers,Suppliers\n2026-10,10,8,2\n2026-11,12,9,3",
    );
  });
});