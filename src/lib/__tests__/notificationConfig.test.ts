import { describe, it, expect } from "vitest";
import {
  ACTION_REQUIRED_TYPES,
  NOTIFICATION_CATEGORIES,
  WARNING_TYPES,
  categoryForType,
  getNotificationTypeConfig,
  notificationDotClass,
  resolveNotificationRoute,
  severityForType,
  typesForSeverity,
  typesForCategory,
} from "@/lib/notificationConfig";
import { BRAND_KEY, isOwnStorefront, storefrontLabel } from "@/lib/brand";

/**
 * Every value of AdminNotificationType in
 * Expedition-Go-Backend-v2/prisma/schema.prisma. A type missing from this list
 * is not necessarily wrong — it may be newly added upstream — but it should be
 * a deliberate decision, not an oversight, because an uncategorised type falls
 * through the category rail with no count.
 */
const ALL_ENUM_TYPES = [
  "NEW_SUPPLIER_APPLICATION",
  "SUPPLIER_STATUS_CHANGE",
  "REVIEW_NEEDS_MODERATION",
  "PAYOUT_NEEDS_APPROVAL",
  "SYSTEM_ALERT",
  "NEW_MESSAGE",
  "TOUR_SUBMITTED_FOR_REVIEW",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_MODIFIED",
  "DOCUMENT_EXPIRING",
  "DOCUMENT_EXPIRED",
  "REFUND_REQUEST",
  "REFUND_CLAIM",
  "PAYMENT_UPCOMING",
  "PAYMENT_COLLECTED",
  "PAYMENT_COLLECTION_FAILED",
  "STRIPE_CUSTOMER_CREATE_FAILED",
  "REFUND_NEEDS_ATTENTION",
  "SUPPLIER_CANCELLATION_REQUEST",
  "SUPPLIER_CANCELLATION_DECIDED",
];

describe("notificationConfig categories", () => {
  it("assigns every enum type to exactly one category", () => {
    const seen = new Map<string, number>();
    for (const category of NOTIFICATION_CATEGORIES) {
      for (const type of category.types) seen.set(type, (seen.get(type) ?? 0) + 1);
    }

    for (const type of ALL_ENUM_TYPES) {
      expect(seen.get(type), `${type} is not categorised`).toBe(1);
    }
  });

  it("never declares a category with no types", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(category.types.length, category.key).toBeGreaterThan(0);
    }
  });

  it("resolves a type to its category and reports unknown ones honestly", () => {
    expect(categoryForType("BOOKING_CONFIRMED")).toBe("bookings");
    expect(categoryForType("PAYOUT_NEEDS_APPROVAL")).toBe("payments");
    expect(categoryForType("NOT_A_REAL_TYPE")).toBeNull();
  });

  it("returns a usable type list for every category", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(typesForCategory(category.key)).toEqual(category.types);
    }
    expect(typesForCategory("bookings").length).toBeGreaterThan(0);
  });
});

describe("notificationConfig severity", () => {
  it("separates decisions from news", () => {
    expect(severityForType("PAYOUT_NEEDS_APPROVAL")).toBe("action");
    expect(severityForType("REVIEW_NEEDS_MODERATION")).toBe("action");
    expect(severityForType("DOCUMENT_EXPIRED")).toBe("warning");
    expect(severityForType("BOOKING_CONFIRMED")).toBe("info");
  });

  it("escalates a repeated cancellation reminder", () => {
    expect(severityForType("SUPPLIER_CANCELLATION_REQUEST")).toBe("action");
    // The reminder flag is what drives the hotter colour, not the severity.
    expect(
      getNotificationTypeConfig("SUPPLIER_CANCELLATION_REQUEST", { reminder: true }).color,
    ).toContain("red");
    expect(
      getNotificationTypeConfig("SUPPLIER_CANCELLATION_REQUEST", { reminder: false }).color,
    ).toContain("amber");
  });

  it("exposes only declared action and warning buckets", () => {
    expect(typesForSeverity("action")).toHaveLength(ACTION_REQUIRED_TYPES.size);
    expect(typesForSeverity("warning")).toHaveLength(WARNING_TYPES.size);
    for (const type of typesForSeverity("action")) {
      expect(severityForType(type)).toBe("action");
    }
    for (const type of typesForSeverity("warning")) {
      expect(severityForType(type)).toBe("warning");
    }
  });

  it("keeps the decision queue a subset of all known types", () => {
    for (const type of [...ACTION_REQUIRED_TYPES, ...WARNING_TYPES]) {
      expect(ALL_ENUM_TYPES).toContain(type);
    }
  });
});

describe("notificationConfig presentation", () => {
  it("gives every enum type an icon and colour", () => {
    for (const type of ALL_ENUM_TYPES) {
      const cfg = getNotificationTypeConfig(type);
      expect(cfg.icon, `${type} has no icon`).toBeDefined();
      expect(cfg.color, `${type} has no colour`).toBeTruthy();
    }
  });

  it("falls back gracefully for an unknown type", () => {
    expect(getNotificationTypeConfig("NOT_A_REAL_TYPE").icon).toBeDefined();
    expect(notificationDotClass("NOT_A_REAL_TYPE")).toBe("bg-text-tertiary");
  });

  it("gives every category a distinct dot colour so rows can be scanned", () => {
    const dots = NOTIFICATION_CATEGORIES.map((c) => notificationDotClass(c.types[0]));
    expect(new Set(dots).size).toBe(NOTIFICATION_CATEGORIES.length);
  });
});

describe("notificationConfig deep links", () => {
  it("resolves a destination for every enum type", () => {
    // A data bag carrying every id field the route map consults, so a missing
    // map entry cannot hide behind a missing field.
    const richData = {
      supplierId: "s1",
      reviewId: "r1",
      tourId: "t1",
      payoutId: "p1",
      payoutRequestId: "pr1",
      bookingId: "b1",
      disputeId: "d1",
      claimId: "c1",
      requestId: "q1",
      payoutMethodId: "pm1",
      conversationId: "c9",
      conversationType: "SUPPLIER_CUSTOMER",
      chatType: "suppliers",
    };

    for (const type of ALL_ENUM_TYPES) {
      const route = resolveNotificationRoute(type, richData);
      expect(route, `${type} has nowhere to go`).not.toBeNull();
      expect(route!.path.startsWith("/")).toBe(true);
    }
  });

  it("builds a booking-specific destination when an id is present", () => {
    expect(resolveNotificationRoute("BOOKING_CONFIRMED", { bookingId: "b7" })).toEqual({
      path: "/admin/bookings?bookingId=b7",
    });
    // Without an id it still lands somewhere useful rather than nowhere.
    expect(resolveNotificationRoute("BOOKING_CONFIRMED")).toEqual({ path: "/admin/bookings" });
  });

  it("routes messages to the right conversation surface", () => {
    expect(
      resolveNotificationRoute("NEW_MESSAGE", {
        conversationId: "c1",
        conversationType: "SUPPLIER_CUSTOMER",
      }),
    ).toEqual({ path: "/admin/chat/customers" });
    // A notification with no conversation to open is not a link.
    expect(resolveNotificationRoute("NEW_MESSAGE")).toBeNull();
  });

  it("ignores unknown types instead of throwing", () => {
    expect(resolveNotificationRoute("NOT_A_REAL_TYPE")).toBeNull();
  });
});

describe("brand awareness", () => {
  it("labels each storefront", () => {
    expect(storefrontLabel("ghana")).toBe("Travio Ghana");
    expect(storefrontLabel("expedition")).toBe("Expedition Go");
    expect(storefrontLabel(null)).toBe("Platform-wide");
    expect(storefrontLabel(undefined)).toBe("Platform-wide");
    // An unrecognised value is shown rather than swallowed.
    expect(storefrontLabel("somewhere")).toBe("somewhere");
  });

  it("recognises this dashboard's own storefront", () => {
    expect(isOwnStorefront(BRAND_KEY)).toBe(true);
    expect(isOwnStorefront("expedition")).toBe(false);
    // Platform-wide is not "ours" — it deserves a label when it appears.
    expect(isOwnStorefront(null)).toBe(false);
  });
});
