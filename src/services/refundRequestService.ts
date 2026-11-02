import api from "@/lib/axios";

/**
 * Supplier refund requests — admin approval queue.
 *
 * A supplier asks to refund a traveller on a delivered trip. Approving is the
 * point where money moves: the traveller is refunded through the original
 * processor and the supplier's share is raised as a charge on their balance
 * (settled against a future payout, never taken from a bank account).
 *
 * The axios interceptor rewrites `/admin` → `/travioghana/admin`.
 */

export type RefundRequestStatus =
  | "PENDING_APPROVAL"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN"
  | "FAILED";

export interface RefundRequestPayload {
  operated: boolean;
  attended: boolean;
  reasonCode: string;
  refundType: "PERCENT" | "AMOUNT";
  value: number;
  note?: string | null;
  requestedByEmail?: string | null;
  requestedById?: string | null;
}

export interface RefundPreview {
  currency: string;
  gross: number;
  refundedSoFar: number;
  refundable: number;
  proposed: number;
  isFull: boolean;
  payoutSettled: boolean;
  supplierPayout: number;
  charge: number;
  refundType: string;
  value: number;
}

export interface SupplierRefundRequest {
  id: string;
  requestNumber: string;
  status: RefundRequestStatus;
  payload: RefundRequestPayload;
  preview: RefundPreview | null;
  decisionNote: string | null;
  decidedAt: string | null;
  executedAt: string | null;
  refundReference: string | null;
  refundedAmount: number | null;
  chargeId: string | null;
  failureReason: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    travelDate: string;
    currency: string;
    grossAmount: number | null;
    refundAmount: number | null;
    customerName: string | null;
    tourTitle: string | null;
    tourSlug: string | null;
  };
  supplier: { id: string; name: string; email: string } | null;
}

export interface RefundRequestDetail extends SupplierRefundRequest {
  /** Recomputed against the live booking — the stored preview may be stale. */
  live: RefundPreview | null;
  /** Set when the request can no longer be executed. */
  blocked: string | null;
  chargedToDate: number;
  supplierBalance: { earnings: number; openCharges: number; available: number } | null;
}

export interface RefundRequestList {
  requests: SupplierRefundRequest[];
  total: number;
  page: number;
  limit: number;
}

export async function listRefundRequests(params: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<RefundRequestList> {
  const response = await api.get("/admin/refund-requests", {
    params,
    skipGlobalErrorHandler: true,
  });
  return response.data?.data || { requests: [], total: 0, page: 1, limit: 20 };
}

export async function getRefundRequest(id: string): Promise<RefundRequestDetail> {
  const response = await api.get(`/admin/refund-requests/${id}`, {
    skipGlobalErrorHandler: true,
  });
  return response.data?.data?.request;
}

export async function approveRefundRequest(id: string, note?: string) {
  const response = await api.post(
    `/admin/refund-requests/${id}/approve`,
    note ? { note } : {},
    { skipGlobalErrorHandler: true },
  );
  return response.data?.data?.request;
}

export async function rejectRefundRequest(id: string, note: string) {
  const response = await api.post(
    `/admin/refund-requests/${id}/reject`,
    { note },
    { skipGlobalErrorHandler: true },
  );
  return response.data?.data?.request;
}

export const STATUS_LABEL: Record<RefundRequestStatus, string> = {
  PENDING_APPROVAL: "Pending",
  EXECUTING: "Processing",
  COMPLETED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  FAILED: "Failed",
};

export const STATUS_CLASS: Record<RefundRequestStatus, string> = {
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  EXECUTING: "bg-sky-50 text-sky-700 border-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};
