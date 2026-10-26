import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/axios", () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

vi.mock("@/hooks/usePermission", () => ({
  isSuperAdmin: () => true,
  usePermission: () => ({ can: () => true, isSuperAdmin: true, loading: false }),
}));

import api from "@/lib/axios";
import { GeneralTab } from "../GeneralTab";

/**
 * The payment-link switches are the only way to turn hosted Stripe Checkout on,
 * so this file pins the two ways the screen could quietly get it wrong:
 *
 *  1. A flag with no row yet must render as Off, not as an empty required
 *     field — otherwise the first deploy blocks saving every other setting.
 *  2. Saving must write only what changed. Silently inserting `false` rows for
 *     the flags would look harmless but hides whether a switch was ever set.
 */

const SERVER_SETTINGS: Record<string, string> = {
  "platform.name": "Travio Ghana",
  "platform.currency": "GHS",
  "platform.support_email": "support@example.com",
  "platform.timezone": "Africa/Accra",
  "commission.default_rate": "0.15",
  "commission.platform_fee": "0",
  "payout.min_threshold": "50",
  "payout.default_cycle": "MONTHLY",
  "payout.auto_generate_enabled": "true",
  "booking.min_advance_hours": "1",
  "booking.max_advance_days": "365",
  "booking.auto_cancel_hours": "24",
  "booking.max_travelers": "20",
};

const PAYMENT_LINK_LABELS = [
  "Hosted payment links",
  "Supplier-sent links",
  "Automatic recovery",
  "Post links in chat",
];

beforeAll(() => {
  // Radix Select measures its trigger and captures the pointer; jsdom ships
  // neither, so without these the menu never opens and every option query
  // silently finds nothing.
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: SERVER_SETTINGS } });
  vi.mocked(api.put).mockImplementation((_url, body) =>
    Promise.resolve({
      data: { data: { ...SERVER_SETTINGS, ...(body as { settings: object }).settings } },
    }),
  );
});

describe("GeneralTab — payment links", () => {
  it("renders every switch as Off when the server has no row for it", async () => {
    renderWithProviders(<GeneralTab />);

    for (const label of PAYMENT_LINK_LABELS) {
      const trigger = await screen.findByLabelText(new RegExp(label, "i"));
      expect(trigger).toBeInTheDocument();
      // Off is the runtime default for a missing row; the switch must say so
      // rather than rendering blank.
      expect(trigger).toHaveTextContent("Off");
    }

    // Missing keys are defaulted, so nothing is dirty and no required-field
    // error blocks the rest of the page.
    expect(screen.getByText(/all settings saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/is required/i)).not.toBeInTheDocument();
  });

  it("does not create payment-link rows when another setting is saved", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GeneralTab />);

    const name = await screen.findByLabelText(/platform name/i);
    await user.clear(name);
    await user.type(name, "Travio Ghana Ltd");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const body = vi.mocked(api.put).mock.calls[0][1] as { settings: Record<string, string> };
    expect(body.settings).toEqual({ "platform.name": "Travio Ghana Ltd" });
  });

  it("writes only the switch that changed, and warns while the master is off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GeneralTab />);

    await user.click(await screen.findByLabelText(/supplier-sent links/i));
    await user.click(await screen.findByRole("option", { name: "On" }));

    // Order matters at runtime: supplier links do nothing without the master.
    expect(screen.getByText(/do nothing until/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const body = vi.mocked(api.put).mock.calls[0][1] as { settings: Record<string, string> };
    expect(body.settings).toEqual({ "feature.supplierPaymentLinks.ghana": "true" });
  });
});
