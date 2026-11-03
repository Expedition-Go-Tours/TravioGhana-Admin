import type { Booking } from "@/types/booking";

/**
 * Who a booking is for, read from whichever source actually has an answer.
 *
 * A checkout that never creates an account (the `guestId` flow) leaves
 * `customer` null — the lead traveller captured at checkout is then the only
 * identity on the row. Every surface that shows a name, email, phone or
 * avatar resolves through here, so a guest booking renders instead of taking
 * the page down with `Cannot read properties of null (reading 'photoURL')`.
 */
export interface BookingContact {
  /** The account behind the booking, when there is one. */
  accountId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  /** True only for a real account: a guest has no profile to open. */
  hasAccount: boolean;
}

const FALLBACK_NAME = "Guest";

export function bookingContact(booking: Booking): BookingContact {
  const customer = booking.customer;
  const firstTravelerName = booking.travelers?.details?.[0]?.name?.trim() || "";

  const name =
    customer?.name?.trim() ||
    booking.leadTravelerName?.trim() ||
    firstTravelerName ||
    FALLBACK_NAME;

  return {
    accountId: customer?.id || null,
    name,
    email: customer?.email?.trim() || booking.leadTravelerEmail?.trim() || null,
    phone:
      customer?.phone?.trim() ||
      booking.leadTravelerPhone?.trim() ||
      booking.travelers?.phoneNumber?.trim() ||
      null,
    photoURL: customer?.photoURL || null,
    hasAccount: Boolean(customer?.id),
  };
}

/** First letter of the resolved name — never an empty string. */
export function contactInitial(contact: BookingContact): string {
  return contact.name.charAt(0).toUpperCase() || "?";
}
