import type { CancellationBooking, CancellationRequest } from "@/services/cancellationService";

/**
 * Who the request is about.
 *
 * A registered customer has a `customer` row. A marketplace guest checkout has
 * none: the traveller is on `leadTravelerName/leadTravelerEmail` and the guest
 * record. The admin queue must name that person instead of showing "—".
 */
export function bookingCustomer(booking?: CancellationBooking | null) {
  const name =
    booking?.customer?.name
    || booking?.leadTravelerName
    || booking?.guest?.name
    || "—";
  const email =
    booking?.customer?.email
    || booking?.leadTravelerEmail
    || booking?.guest?.email
    || "";
  const guest = !booking?.customer && Boolean(booking?.leadTravelerName || booking?.guest);
  return { name, email, guest };
}

// Words that indicate the supplier could not run the tour, rather than the
// customer choosing to leave. A request filed as CUSTOMER_REQUESTED with one
// of these explanations skips the 25% fee and the rate hit, so the admin must
// look before approving.
const OPERATIONAL_HINTS =
  /(\bguide\b|\bstaff\b|\bvehicle\b|\bequipment\b|\bbreakdown\b|\boverbook|\bcapacity\b|\bvenue\b|\bclosed\b|\bschedule\b|\bunavailable\b|\bnot available\b|\bill\b|\bemergency\b)/i;

export function hasCategoryMismatch(request?: CancellationRequest | null): boolean {
  const category = String(
    request?.payload?.cancellationCategory
    || request?.booking?.cancellationCategory
    || "",
  ).toUpperCase();
  const explanation = String(
    request?.payload?.explanation
    || request?.payload?.supplierNotes
    || "",
  );
  return category === "CUSTOMER_REQUESTED" && OPERATIONAL_HINTS.test(explanation);
}

// Mirrors the backend taxonomy for the cases the admin sees most often. The
// API also sends reasonLabel/categoryLabel; these are the fallback for older
// rows and for pending requests embedded on the booking detail.
const CODE_LABELS: Record<string, string> = {
  CUSTOMER_REQUESTED_CANCEL: "Customer asked to cancel this booking",
  GUIDE_UNAVAILABLE: "Guide or staff unavailable",
  VEHICLE_BREAKDOWN: "Vehicle or equipment breakdown",
  OVERBOOKED: "Overbooked or capacity issue",
  NOT_ENOUGH_TRAVELERS: "Not enough travellers",
  VENUE_CLOSED: "Venue or facility closed",
  SCHEDULING_CONFLICT: "Scheduling conflict",
  OPERATIONAL_OTHER: "Other operational reason",
  WEATHER: "Adverse weather conditions",
  NATURAL_DISASTER: "Natural disaster",
  GOVERNMENT_ACTION: "Government action or travel advisory",
  STRIKE: "Strike or civil unrest",
  SAFETY_INCIDENT: "Safety or security incident",
  PUBLIC_HEALTH: "Public health restriction",
  FORCE_MAJEURE_OTHER: "Other force majeure event",
};

const CATEGORY_LABELS: Record<string, string> = {
  OPERATIONAL: "Operational",
  FORCE_MAJEURE: "Force majeure",
  CUSTOMER_REQUESTED: "Customer requested",
};

function humanize(value: string): string {
  const words = value.replace(/_+/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function cancellationReasonLabel(code?: string | null): string {
  if (!code) return "";
  return CODE_LABELS[code] || humanize(code);
}

export function cancellationCategoryLabel(category?: string | null): string {
  if (!category) return "";
  return CATEGORY_LABELS[category] || humanize(category);
}

