import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { InvoicesTab } from "../InvoicesTab";
import type { Invoice } from "@/types/payout";

/**
 * The invoice queue is where finance pays suppliers, so the two things that
 * matter are the receipt (does the invoice itemise the money it claims?) and
 * the reference gate (money never leaves the balance without the real bank
 * reference). Both are asserted here; the third check is that the Due tab
 * explains itself when empty instead of looking broken.
 */

vi.mock("@/lib/axios", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("@/lib/adminSocket", () => ({
  getAdminSocket: () => ({ on: () => {}, off: () => {} }),
}));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: () => true,
    isSuperAdmin: true,
    adminRole: { id: "role-1", name: "super_admin", permissions: [] },
    loading: false,
    setAdminRole: () => {},
  }),
}));

import api from "@/lib/axios";

const apiGet = vi.mocked(api.get);
const apiPatch = vi.mocked(api.patch);

// Dates at local midday so formatDate can't flip a day across timezones.
const DUE: Invoice = {
  id: "inv-due-1",
  invoiceNumber: "INV-2026-0001",
  supplierId: "u-rich",
  supplier: { id: "u-rich", name: "Expedition-Go Tours LTD", email: "expedition@example.com" },
  cycle: "TWICE_MONTHLY",
  cycleStartDate: "2026-09-01T12:00:00",
  cycleEndDate: "2026-09-15T12:00:00",
  cycleLabel: "1–15 Sep 2026",
  invoicedAt: "2026-09-16T12:00:00",
  paymentScheduledAt: "2026-09-20T12:00:00",
  paidAt: null,
  reference: null,
  status: "INVOICED",
  grossTotal: 1000,
  commissionTotal: 170,
  netTotal: 830,
  currency: "USD",
  bookingCount: 2,
  payoutMethod: {
    id: "pm-1",
    type: "MOBILE_MONEY",
    mobileProvider: "MTN",
    mobileNumber: "0244 123 4567",
  },
  items: [
    {
      id: "ii-1",
      invoiceId: "inv-due-1",
      bookingId: "b-1",
      grossAmount: 600,
      platformCommission: 102,
      supplierPayout: 498,
      currency: "USD",
      booking: {
        bookingNumber: "GHA-33723361-2026-01",
        travelDate: "2026-09-03T12:00:00",
        tour: { title: "Cape Coast Castle & Kakum National Park Tour" },
      },
    },
    {
      id: "ii-2",
      invoiceId: "inv-due-1",
      bookingId: "b-2",
      grossAmount: 400,
      platformCommission: 68,
      supplierPayout: 332,
      currency: "USD",
      booking: {
        bookingNumber: "GHA-35795466-2026-02",
        travelDate: "2026-09-10T12:00:00",
        tour: { title: "The Ghana Naming Ceremony Tour" },
      },
    },
  ],
  createdAt: "2026-09-16T12:00:00",
};

function mockApi(invoices: Invoice[]) {
  apiGet.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes("?")) {
      const statusCounts: Record<string, number> = { INVOICED: 0, PAID: 2, CANCELLED: 0 };
      for (const inv of invoices) statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      return Promise.resolve({
        data: {
          data: {
            invoices,
            pagination: { currentPage: 1, limit: 20, totalCount: invoices.length, totalPages: 1 },
            summary: {
              statusCounts,
              totalCount: Object.values(statusCounts).reduce((s, n) => s + n, 0),
              totalAmount: invoices.reduce((s, i) => s + Number(i.netTotal), 0),
            },
          },
        },
      }) as never;
    }
    // Detail: /admin/finance/invoices/:id
    const id = u.split("/admin/finance/invoices/")[1];
    return Promise.resolve({
      data: { data: { invoice: invoices.find((i) => i.id === id) || DUE } },
    }) as never;
  });
}

const rowOf = (number: string) => screen.getByText(number).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  apiPatch.mockResolvedValue({ data: { data: {} } } as never);
  mockApi([DUE]);
});

describe("InvoicesTab — the due queue", () => {
  it("leads with the invoice, the supplier, the net and the Due state", async () => {
    renderWithProviders(<InvoicesTab />);

    expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();

    const row = rowOf("INV-2026-0001");
    expect(within(row).getByText("Expedition-Go Tours LTD")).toBeInTheDocument();
    expect(within(row).getByText("$830.00")).toBeInTheDocument();
    expect(within(row).getByText("Due")).toBeInTheDocument();
    // The processing date is the whole point of the window — no guessing.
    expect(within(row).getByText(/Pay by Sep 20, 2026/)).toBeInTheDocument();
    // Totals line counts all statuses even while the Due tab is selected.
    expect(screen.getByText(/3 invoices across all statuses/)).toBeInTheDocument();
    expect(screen.getByText(/showing 1 due/)).toBeInTheDocument();
  });

  it("asks the API for the selected status tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicesTab />);
    await screen.findByText("INV-2026-0001");

    await user.click(screen.getByRole("button", { name: /^paid/i }));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("status=PAID")),
    );
  });
});

describe("InvoicesTab — the receipt", () => {
  it("expands into the derivation, the activity window and a reconciled total", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicesTab />);
    await screen.findByText("INV-2026-0001");

    await user.click(rowOf("INV-2026-0001"));

    // Lazily fetched for this invoice only.
    expect(apiGet).toHaveBeenCalledWith("/admin/finance/invoices/inv-due-1");

    expect(screen.getByText("Commission (17%)")).toBeInTheDocument();
    expect(screen.getByText("Activity dates")).toBeInTheDocument();
    expect(screen.getByText("Sep 1, 2026 – Sep 15, 2026")).toBeInTheDocument();
    expect(screen.getAllByText("$830.00").length).toBeGreaterThan(0);

    const table = await screen.findByRole("table", { name: /bookings billed on invoice inv-2026-0001/i });
    expect(within(table).getByText("GHA-33723361-2026-01")).toBeInTheDocument();
    expect(within(table).getByText(/Cape Coast Castle/)).toBeInTheDocument();
    // Items must reconcile with the invoice net instead of being trusted.
    expect(within(table).getByText(/matches invoice/)).toBeInTheDocument();
    expect(within(table).getByText("$830.00")).toBeInTheDocument();
  });

  it("shows the mobile-money destination the money will go to", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicesTab />);
    await screen.findByText("INV-2026-0001");

    await user.click(rowOf("INV-2026-0001"));

    expect(await screen.findByText(/MOBILE MONEY/)).toBeInTheDocument();
    expect(screen.getByText(/MTN/)).toBeInTheDocument();
  });
});

describe("InvoicesTab — marking paid", () => {
  it("refuses to close the invoice without a real bank reference", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicesTab />);
    await screen.findByText("INV-2026-0001");

    await user.click(screen.getByRole("button", { name: "Mark invoice INV-2026-0001 as paid" }));

    const confirm = await screen.findByRole("button", { name: "Confirm paid" });
    const input = screen.getByLabelText("Transaction reference (required)");
    expect(confirm).toBeDisabled();

    // Placeholder text is not a bank reference. One change event, because
    // ConfirmModal moves focus to Cancel 100ms after open and would otherwise
    // steal keystrokes mid-type.
    fireEvent.change(input, { target: { value: "test" } });
    expect(screen.getByText(/looks like a placeholder/i)).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "TRX-8841209" } });
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(apiPatch).toHaveBeenCalledWith("/admin/finance/invoices/inv-due-1/mark-paid", {
      reference: "TRX-8841209",
    });
    // Modal closes once the server accepts, not before.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirm paid" })).not.toBeInTheDocument(),
    );
  });

  it("never fires the mutation when the reference field is left empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicesTab />);
    await screen.findByText("INV-2026-0001");

    await user.click(screen.getByRole("button", { name: "Mark invoice INV-2026-0001 as paid" }));
    const confirm = await screen.findByRole("button", { name: "Confirm paid" });
    expect(confirm).toBeDisabled();

    // The dialog stays put — disabled is enforced in the button itself.
    expect(apiPatch).not.toHaveBeenCalled();
    await user.click(confirm);
    expect(apiPatch).not.toHaveBeenCalled();
  });
});

describe("InvoicesTab — empty due queue", () => {
  it("says invoices arrive on the invoice date instead of looking broken", async () => {
    mockApi([]);
    renderWithProviders(<InvoicesTab />);

    expect(
      await screen.findByText(/no invoices due — invoices generate automatically/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/invoices appear here on each supplier's invoice date/i),
    ).toBeInTheDocument();
  });
});
