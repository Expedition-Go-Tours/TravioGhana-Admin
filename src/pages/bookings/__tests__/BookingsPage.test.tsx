import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router-dom";
import { renderWithProviders } from "@/test/test-utils";
import type { Booking } from "@/types/booking";

vi.mock("@/hooks/useSocketEvent", () => ({
  useSocketInvalidate: () => {},
  useSocketEvent: () => {},
}));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: () => true,
    isSuperAdmin: true,
    adminRole: { id: "role_1", name: "super_admin", permissions: [] },
    loading: false,
    setAdminRole: () => {},
  }),
}));

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import BookingsPage from "../BookingsPage";

function makeBooking(id: string, bookingNumber: string): Booking {
  return {
    id,
    bookingNumber,
    status: "CONFIRMED",
    paymentStatus: "SUCCEEDED",
    paymentTiming: "now",
    grossAmount: 500,
    currency: "USD",
    travelDate: new Date("2026-12-01").toISOString(),
    selectedTime: null,
    subtotal: 500,
    taxes: 0,
    fees: 0,
    discounts: 0,
    commissionRate: 0.2,
    platformCommission: 100,
    supplierPayout: 400,
    travelers: { adults: 2, children: 0, infants: 0 },
    specialRequests: null,
    paidAt: new Date("2026-10-01").toISOString(),
    createdAt: new Date("2026-09-20").toISOString(),
    updatedAt: new Date("2026-09-20").toISOString(),
    leadTravelerName: null,
    leadTravelerEmail: null,
    leadTravelerPhone: null,
    pickup: null,
    source: "ghana",
    offerName: null,
    offerPromoCode: null,
    offerDiscountType: null,
    offerDiscountPct: null,
    offerDiscountFix: null,
    appliedOffer: null,
    customer: {
      id: "cus_1",
      name: "Ama Mensah",
      email: "ama@example.com",
      phone: "+233200000001",
      photoURL: null,
    },
    tour: {
      id: "tour_1",
      title: "Cape Coast Castle Day Trip",
      coverPhoto: null,
      supplier: { id: "sup_1", name: "Gold Coast Tours" },
    },
    payouts: [],
    pendingCancellation: null,
    cancellationCode: null,
    cancellationCategory: null,
    cancellationOrigin: null,
    countsTowardRate: null,
    cancellationFee: null,
    refundStatus: null,
    refundAmount: null,
    cancelledAt: null,
    cancellationChoiceDeadline: null,
    customerChoice: null,
  };
}

const bookings = [makeBooking("bk_1", "TG-1001"), makeBooking("bk_2", "TG-2002")];

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    // Detail fetch used by the deep link when the booking is not in a cache.
    if (url.startsWith("/admin/bookings/") && !url.includes("?")) {
      const id = url.split("/").pop();
      const booking = bookings.find((b) => b.id === id);
      return Promise.resolve({ data: { data: booking } });
    }
    // List fetch.
    return Promise.resolve({
      data: {
        data: {
          bookings,
          pagination: { currentPage: 1, totalPages: 1, totalCount: bookings.length, limit: 20 },
          counts: {},
        },
      },
    });
  });
});

/**
 * Mirrors the real inbox: a header (the bell) that can "navigate" to a
 * booking notification's deep link while the bookings page stays mounted —
 * the exact scenario that used to be swallowed by the one-shot latch.
 */
function DeepLinkHarness() {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate("/bookings?bookingId=bk_1")}>Notify bk_1</button>
      <button onClick={() => navigate("/bookings?bookingId=bk_2")}>Notify bk_2</button>
      <BookingsPage />
    </div>
  );
}

describe("BookingsPage deep links", () => {
  it("opens the detail sidebar for a booking notification deep link on fresh mount", async () => {
    renderWithProviders(<BookingsPage />, {
      initialEntries: ["/bookings?bookingId=bk_1"],
    });

    expect(await screen.findByRole("heading", { name: "TG-1001" })).toBeInTheDocument();
    expect(screen.getByText("Booking detail")).toBeInTheDocument();
  });

  it("opens a new booking's sidebar for every notification click while the page stays mounted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeepLinkHarness />, { initialEntries: ["/bookings"] });

    await user.click(screen.getByRole("button", { name: "Notify bk_1" }));
    expect(await screen.findByRole("heading", { name: "TG-1001" })).toBeInTheDocument();

    // Second notification click while the page is already open (bell flow).
    await user.click(screen.getByRole("button", { name: "Notify bk_2" }));
    expect(await screen.findByRole("heading", { name: "TG-2002" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "TG-1001" })).not.toBeInTheDocument(),
    );
  });

  it("reopens the same booking from a notification after the sidebar was closed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeepLinkHarness />, { initialEntries: ["/bookings"] });

    await user.click(screen.getByRole("button", { name: "Notify bk_1" }));
    expect(await screen.findByRole("heading", { name: "TG-1001" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close booking detail" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "TG-1001" })).not.toBeInTheDocument(),
    );

    // Same notification again — must reopen now that the sidebar is closed.
    await user.click(screen.getByRole("button", { name: "Notify bk_1" }));
    expect(await screen.findByRole("heading", { name: "TG-1001" })).toBeInTheDocument();
  });
});
/**
 * A checkout that never creates an account leaves `customer` null — the lead
 * traveller is then the only identity on the row. One such booking used to
 * take the whole page down with
 * "Cannot read properties of null (reading 'photoURL')".
 */
describe("BookingsPage guest bookings (no account)", () => {
  const guestBooking: Booking = {
    ...makeBooking("bk_g", "TG-9009"),
    customer: null,
    leadTravelerName: "Thomas Rhodes",
    leadTravelerEmail: "thomas@example.com",
    leadTravelerPhone: "+233200000009",
  };

  beforeEach(() => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith("/admin/bookings/") && !url.includes("?")) {
        return Promise.resolve({ data: { data: guestBooking } });
      }
      return Promise.resolve({
        data: {
          data: {
            bookings: [guestBooking],
            pagination: { currentPage: 1, totalPages: 1, totalCount: 1, limit: 20 },
            counts: {},
          },
        },
      });
    });
  });

  it("renders the lead traveller in the list instead of crashing", async () => {
    renderWithProviders(<BookingsPage />, { initialEntries: ["/bookings"] });

    expect(await screen.findByText("Thomas Rhodes")).toBeInTheDocument();
    expect(screen.getByText("thomas@example.com")).toBeInTheDocument();
  });

  it("opens the detail panel with no customer profile to open", async () => {
    renderWithProviders(<BookingsPage />, {
      initialEntries: ["/bookings?bookingId=bk_g"],
    });

    expect(await screen.findByRole("heading", { name: "TG-9009" })).toBeInTheDocument();
    expect(screen.getByText(/booked as a guest/i)).toBeInTheDocument();
    // The address shows in the list row, the panel and a mailto link.
    expect(screen.getAllByText("thomas@example.com").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /view profile/i })).not.toBeInTheDocument();
  });
});
