import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    can: () => true,
    isSuperAdmin: true,
    adminRole: { id: "role_1", name: "super_admin", permissions: [] },
    loading: false,
    setAdminRole: () => {},
  }),
}));

vi.mock("@/hooks/useSocketEvent", () => ({
  useSocketInvalidate: () => {},
  useSocketEvent: () => {},
}));

vi.mock("@/services/cancellationService", () => ({
  getCancellationRequests: vi.fn(),
  getCancellationRequest: vi.fn(),
  approveCancellationRequest: vi.fn(),
  rejectCancellationRequest: vi.fn(),
  batchApproveCancellationRequests: vi.fn(),
  getCancellationErrorMessage: (_err: unknown, fallback: string) => fallback,
  getCancellationErrorStatus: () => undefined,
}));

import {
  getCancellationRequests,
  getCancellationRequest,
  approveCancellationRequest,
  rejectCancellationRequest,
  batchApproveCancellationRequests,
} from "@/services/cancellationService";
import CancellationsPage from "../CancellationsPage";

const pendingRequest = {
  id: "req_1",
  status: "PENDING_APPROVAL",
  bookingId: "bk_1",
  booking: {
    id: "bk_1",
    bookingNumber: "TG-1001",
    status: "CONFIRMED",
    paymentStatus: "SUCCEEDED",
    grossAmount: 1000,
    currency: "USD",
    travelDate: new Date("2026-10-01").toISOString(),
    customer: { id: "cus_1", name: "Ama Mensah", email: "ama@example.com" },
    refundStatus: null,
    refundAmount: null,
    cancellationCode: null,
    cancelledAt: null,
  },
  tour: {
    id: "tour_1",
    title: "Cape Coast Castle Day Trip",
    supplier: { id: "sup_1", name: "Gold Coast Tours" },
  },
  supplier: { id: "sup_1", name: "Gold Coast Tours", email: "ops@goldcoast.com" },
  payload: {
    cancellationCode: "SUPPLIER_EMERGENCY",
    cancellationCategory: "OPERATIONAL",
    explanation: "Vehicle breakdown — no replacement available.",
  },
  preview: { refund: { amount: 1000, note: "Full refund" }, fee: 250, countsTowardRate: false },
  stopSellingApplied: true,
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
};

const listResponse = {
  requests: [pendingRequest],
  pendingCount: 1,
  pagination: { currentPage: 1, totalPages: 1, totalCount: 1, limit: 20 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCancellationRequests).mockResolvedValue(listResponse as never);
  vi.mocked(getCancellationRequest).mockResolvedValue(pendingRequest as never);
});

describe("CancellationsPage", () => {
  it("renders the pending queue with row details", async () => {
    renderWithProviders(<CancellationsPage />);

    await waitFor(() => {
      expect(screen.getByText("TG-1001")).toBeInTheDocument();
    });
    expect(screen.getByText("Cape Coast Castle Day Trip")).toBeInTheDocument();
    expect(screen.getAllByText("Gold Coast Tours").length).toBeGreaterThan(0);
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText(/fee \$250\.00/)).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("shows an empty state when there are no requests", async () => {
    vi.mocked(getCancellationRequests).mockResolvedValueOnce({
      requests: [],
      pendingCount: 0,
      pagination: { currentPage: 1, totalPages: 1, totalCount: 0, limit: 20 },
    } as never);

    renderWithProviders(<CancellationsPage />);

    await waitFor(() => {
      expect(screen.getByText("No pending requests")).toBeInTheDocument();
    });
  });

  it("refetches with the selected status tab", async () => {
    renderWithProviders(<CancellationsPage />);
    await waitFor(() => expect(screen.getByText("TG-1001")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Approved" }));

    await waitFor(() => {
      expect(getCancellationRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "APPROVED" }),
      );
    });
  });

  it("opens the detail drawer from a deep link and approves with a note", async () => {
    vi.mocked(approveCancellationRequest).mockResolvedValue({
      booking: pendingRequest.booking,
      cancellation: { refundAmount: 1000, fee: 250, refundStatus: "SUCCEEDED", refundExecuted: true },
      request: { ...pendingRequest, status: "APPROVED" },
    } as never);

    renderWithProviders(<CancellationsPage />, {
      initialEntries: ["/cancellations?request=req_1"],
    });

    await waitFor(() => {
      expect(getCancellationRequest).toHaveBeenCalledWith("req_1");
    });

    const drawer = await screen.findByLabelText("Cancellation request detail");
    await userEvent.click(await within(drawer).findByRole("button", { name: /approve & refund/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/executes a full refund/i)).toBeInTheDocument();

    // ConfirmModal focuses its Cancel button ~100ms after opening; let that
    // settle before typing so the focus move can't interrupt the keystrokes.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const noteField = within(dialog).getByLabelText(/decision note/i);
    await userEvent.click(noteField);
    await userEvent.type(noteField, "Verified with ops");
    await userEvent.click(within(dialog).getByRole("button", { name: /approve & refund/i }));

    await waitFor(() => {
      expect(approveCancellationRequest).toHaveBeenCalledWith("req_1", { note: "Verified with ops" });
    });
  });

  it("requires a reason of at least 3 characters to reject", async () => {
    vi.mocked(rejectCancellationRequest).mockResolvedValue({
      ...pendingRequest,
      status: "REJECTED",
    } as never);

    renderWithProviders(<CancellationsPage />, {
      initialEntries: ["/cancellations?request=req_1"],
    });

    const drawer = await screen.findByLabelText("Cancellation request detail");
    await userEvent.click(await within(drawer).findByRole("button", { name: /reject/i }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /reject request/i });
    expect(confirm).toBeDisabled();

    // Let ConfirmModal's Cancel autofocus settle before typing.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reason = within(dialog).getByLabelText(/reason \(required/i);
    await userEvent.click(reason);
    await userEvent.type(reason, "no");
    expect(confirm).toBeDisabled();

    await userEvent.type(reason, "pe");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    await waitFor(() => {
      expect(rejectCancellationRequest).toHaveBeenCalledWith("req_1", { note: "nope" });
    });
  });

  it("batch approves the selected requests and shows per-request results", async () => {
    vi.mocked(batchApproveCancellationRequests).mockResolvedValue({
      requested: 1,
      approved: 1,
      failed: 0,
      results: [{ id: "req_1", ok: true, bookingId: "bk_1" }],
    } as never);

    renderWithProviders(<CancellationsPage />);
    await waitFor(() => expect(screen.getByText("TG-1001")).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText("Select TG-1001"));
    await userEvent.click(screen.getByRole("button", { name: /approve selected/i }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /approve 1/i }));

    await waitFor(() => {
      expect(batchApproveCancellationRequests).toHaveBeenCalledWith({ ids: ["req_1"] });
    });
    expect(await screen.findByText("Batch approve complete")).toBeInTheDocument();
    expect(screen.getByText(/1 approved · 0 failed/i)).toBeInTheDocument();
  });
});
