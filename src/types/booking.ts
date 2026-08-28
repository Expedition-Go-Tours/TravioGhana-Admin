export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "PROCESSING"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export function isPaymentPaid(status: PaymentStatus | string): boolean {
  return status === "SUCCEEDED";
}

export interface BookingPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface BookingCustomer {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  phone?: string | null;
}

export interface BookingTour {
  id: string;
  title: string;
  coverPhoto?: string | null;
  supplier: {
    id: string;
    name: string;
  };
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentTiming?: "now" | "later";
  grossAmount: number;
  currency: string;
  travelDate: string;
  selectedTime?: string | null;
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  commissionRate: number;
  platformCommission: number;
  supplierPayout: number;
  travelers: TravelerData;
  specialRequests?: string | null;
  cancellationReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leadTravelerName?: string | null;
  leadTravelerEmail?: string | null;
  leadTravelerPhone?: string | null;
  pickup?: PickupData | null;
  source?: string;
  offerName?: string | null;
  offerPromoCode?: string | null;
  offerDiscountType?: string | null;
  offerDiscountPct?: number | null;
  offerDiscountFix?: number | null;
  appliedOffer?: {
    id: string;
    name: string;
    offerType: string;
    discountType: string;
    discountPercentage?: number | null;
    fixedDiscountValue?: number | null;
    promoCode?: string | null;
  } | null;
  customer: BookingCustomer;
  tour: BookingTour;
  payouts: BookingPayout[];
}

export interface TravelerDetail {
  name?: string;
  age?: number;
  ageGroup?: string;
  specialRequests?: string;
}

export interface TravelerData {
  adults: number;
  children: number;
  infants: number;
  seniors?: number;
  phoneNumber?: string;
  location?: string;
  details?: TravelerDetail[];
}

export interface PickupData {
  mode?: string;
  areaName?: string;
  locationName?: string;
  address?: { name?: string; address?: string; lat?: number; lng?: number } | null;
  time?: string;
  instructions?: string;
  pickupLater?: boolean;
}

export function travelerCount(travelers: TravelerData | null | undefined): number {
  if (!travelers || typeof travelers !== "object") return 0;
  return (travelers.adults || 0) + (travelers.children || 0) + (travelers.infants || 0) + (travelers.seniors || 0);
}
