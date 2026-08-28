export interface Payout {
  id: string;
  supplier?: {
    name?: string;
    id?: string;
    email?: string;
    phone?: string;
    photoURL?: string;
    user?: { photoURL?: string };
    supplierProfile?: {
      businessInfo?: {
        legalBusinessName?: string;
        displayName?: string;
        country?: string;
        city?: string;
        phone?: string;
        address?: string | { city?: string; line1?: string; state?: string; postalCode?: string };
        phoneNumber?: string;
      };
      payoutInfo?: Record<string, unknown>;
    };
  };
  tour?: { title?: string };
  booking?: { bookingNumber?: string; grossAmount?: string; paidAt?: string; tour?: { title?: string } };
  bookingId?: string;
  amount?: number | string;
  commissionAmount?: number | string;
  status?: string;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  processedAt?: string;
  processedBy?: string;
  paidAt?: string;
  notes?: string;
  commission?: number | string;
  payoutMethod?: {
    id?: string;
    type?: string;
    details?: string;
    bankName?: string;
    accountNumber?: string;
    isDefault?: boolean;
    verified?: boolean;
  };
  reference?: string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
}

// ── Finance v2 ──

export interface PayoutRequestItem {
  id: string;
  bookingId: string;
  booking?: {
    bookingNumber?: string;
    travelDate?: string;
    grossAmount?: number | string;
    currency?: string;
    status?: string;
    tour?: { title?: string };
  };
  grossAmount?: number | string;
  platformCommission?: number | string;
  supplierPayout?: number | string;
  currency?: string;
}

export interface PayoutRequest {
  id: string;
  requestNumber: string;
  supplierId: string;
  supplier?: { id?: string; name?: string; email?: string };
  amount: number | string;
  currency: string;
  bookingCount: number;
  status: "PROCESSING" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED";
  cycleStartDate: string;
  cycleEndDate: string;
  cycleLabel: string;
  payoutMethodId?: string | null;
  payoutMethod?: {
    id?: string;
    type?: string;
    bankName?: string;
    paypalEmail?: string;
    accountName?: string;
    accountNumber?: string;
    swiftCode?: string;
    iban?: string;
  } | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  reference?: string | null;
  notes?: string | null;
  items?: PayoutRequestItem[];
  createdAt: string;
}

export interface Dispute {
  id: string;
  disputeNumber: string;
  bookingId: string;
  booking?: {
    bookingNumber?: string;
    travelDate?: string;
    grossAmount?: number | string;
    currency?: string;
    tour?: { title?: string };
  } | null;
  openedById: string;
  opener?: { name?: string; email?: string };
  supplierId: string;
  supplier?: { id?: string; name?: string; email?: string };
  reason: string;
  description?: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_CUSTOMER" | "RESOLVED_SUPPLIER" | "WITHDRAWN";
  resolution?: string | null;
  resolvedAt?: string | null;
  refundAmount?: number | string | null;
  createdAt: string;
}
