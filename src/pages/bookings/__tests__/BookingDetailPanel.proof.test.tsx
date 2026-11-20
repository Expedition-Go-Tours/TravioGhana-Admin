/**
 * Downloading the proof of payment from the booking detail panel.
 *
 * The PDF itself is covered by backend tests; what matters here is that the
 * button asks the brand-scoped endpoint for a blob, names the file after the
 * booking reference, and never leaves the button spinning or the user without
 * feedback when the request fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import type { Booking } from "@/types/booking";
import { toast } from "sonner";

const perms = vi.hoisted(() => ({ can: (() => true) as (permission: string) => boolean }));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: perms.can,
    isSuperAdmin: false,
    adminRole: { id: "role_1", name: "ops", permissions: ["bookings.view"] },
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

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return { ...actual, toast: { ...actual.toast, error: vi.fn(), success: vi.fn() } };
});

import { BookingDetailPanel } from "../components/BookingDetailPanel";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "bk_1",
    bookingNumber: "TRG-86414786-2026-46",
    status: "COMPLETED",
    paymentStatus: "SUCCEEDED",
    paymentTiming: "later",
    grossAmount: 540,
    currency: "USD",
    travelDate: new Date("2026-11-04").toISOString(),
    selectedTime: null,
    subtotal: 540,
    taxes: 0,
    fees: 0,
    discounts: 0,
    commissionRate: 0.15,
    platformCommission: 81,
    supplierPayout: 459,
    travelers: { adults: 6, children: 0, infants: 0 },
    specialRequests: null,
    paidAt: new Date("2026-11-03").toISOString(),
    createdAt: new Date("2026-10-22").toISOString(),
    updatedAt: new Date("2026-11-04").toISOString(),
    leadTravelerName: "Priscilla Hankins",
    leadTravelerEmail: "hankins460@gmail.com",
    leadTravelerPhone: "+17574071603",
    pickup: null,
    source: "GHANA",
    offerName: null,
    offerPromoCode: null,
    offerDiscountType: null,
    offerDiscountPct: null,
    offerDiscountFix: null,
    appliedOffer: null,
    customer: {
      id: "cus_1",
      name: "Wayne Gibson",
      email: "drwgibson@gmail.com",
      phone: null,
      photoURL: null,
    },
    tour: {
      id: "tour_1",
      title: "Cape Coast Castle, Elmina Castle & Kakum National Park Tour",
      coverPhoto: null,
      supplier: { id: "sup_1", name: "Expedition-Go Tours LTD" },
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
    ...overrides,
  };
}

function renderPanel(booking: Booking) {
  return renderWithProviders(
    <BookingDetailPanel
      booking={booking}
      onClose={() => {}}
      onConfirmPayment={() => {}}
      onChargeNow={() => {}}
      onViewCustomer={() => {}}
    />,
  );
}

let anchorClick: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  perms.can = (permission: string) => permission === "bookings.view";
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:proof"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn(),
  });
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  anchorClick.mockRestore();
});

describe("BookingDetailPanel — proof of payment", () => {
  it("requests the brand-scoped PDF and saves it under the booking reference", async () => {
    const user = userEvent.setup();
    const pdf = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    mockGet.mockResolvedValue({ data: pdf });

    renderPanel(makeBooking());

    const button = screen.getByRole("button", { name: /download proof of payment/i });
    expect(button).toBeEnabled();

    await user.click(button);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/admin/bookings/bk_1/proof-of-payment",
        expect.objectContaining({ responseType: "blob" }),
      );
    });

    await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));
    const link = anchorClick.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("proof-of-payment-TRG-86414786-2026-46.pdf");
    expect(link.href).toContain("blob:proof");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a spinner while the PDF is generating and restores the button after", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => {};
    mockGet.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    renderPanel(makeBooking());

    await user.click(screen.getByRole("button", { name: /download proof of payment/i }));

    const busy = screen.getByRole("button", { name: /preparing pdf/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    resolveRequest({ data: new Blob(["%PDF-1.7"]) });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /download proof of payment/i })).toBeEnabled(),
    );
  });

  it("tells the user when the document could not be generated", async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValue(new Error("500"));

    renderPanel(makeBooking());

    await user.click(screen.getByRole("button", { name: /download proof of payment/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not generate the proof of payment. Try again.",
      ),
    );
    expect(anchorClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /download proof of payment/i })).toBeEnabled();
  });

  it("is hidden without bookings.view", () => {
    perms.can = () => false;

    renderPanel(makeBooking());

    expect(
      screen.queryByRole("button", { name: /download proof of payment/i }),
    ).not.toBeInTheDocument();
  });
});

describe("BookingDetailPanel — pay-later lifecycle", () => {
  it("draws the three stops once the deferred charge has settled", () => {
    renderPanel(makeBooking());

    expect(screen.getByText("Pay later")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("Charged")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText(/Charged 1 day before the activity\./)).toBeInTheDocument();
  });

  it("marks the charge as scheduled while the sweep is still waiting", () => {
    renderPanel(makeBooking({ paymentStatus: "PENDING", paidAt: null }));

    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/The charge runs automatically before the activity date\./),
    ).toBeInTheDocument();
    expect(screen.queryByText("Settled")).not.toBeInTheDocument();
  });

  it("counts failed attempts instead of hiding them", () => {
    renderPanel(makeBooking({ paymentStatus: "PENDING", paidAt: null, chargeRetries: 2 }));

    expect(screen.getByText(/2 failed attempts so far\./)).toBeInTheDocument();
  });

  it("escalates when the customer must finish payment", () => {
    renderPanel(
      makeBooking({
        paymentStatus: "PENDING",
        paidAt: null,
        requiresPaymentActionAt: new Date("2026-11-03T10:00:00Z").toISOString(),
      }),
    );

    expect(screen.getByText("Action needed")).toBeInTheDocument();
    expect(screen.getByText(/3-D Secure or a new card/i)).toBeInTheDocument();
  });

  it("labels a booking charged at checkout plainly", () => {
    renderPanel(makeBooking({ paymentTiming: "now" }));

    expect(screen.getByText("Charged at booking")).toBeInTheDocument();
    expect(screen.queryByText("Pay later")).not.toBeInTheDocument();
  });
});
