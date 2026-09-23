import api from "@/lib/axios";

/**
 * Supplier Cancellation Requests — admin approval queue.
 *
 * Contract: CANCELLATION-APPROVAL-CONTRACT.md
 * Endpoints live at `/admin/cancellation-requests` (the axios interceptor
 * rewrites `/admin` → `/travioghana/admin`, brand-scoping the queue).
 */

export type CancellationStatus =
  | "PENDING_APPROVAL"
  | "APPROVING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "SUPERSEDED";

export interface CancellationPayload {
  cancellationCode?: string;
  cancellationCategory?: string;
  explanation?: string;
  evidenceUrl?: string | null;
  customerRefundAgreed?: boolean;
  agreedToTerms?: boolean;
  supplierNotes?: string | null;
  countsTowardRate?: boolean;
  [key: string]: unknown;
}

export interface CancellationRefundPreview {
  amount: number;
  note?: string;
}

export interface CancellationStopSellSnapshot {
  tourId?: string;
  marker?: string;
  blocked?: Array<{ date: string }>;
  snapshot?: unknown[];
}

export interface CancellationPreview {
  refund?: CancellationRefundPreview;
  fee?: number;
  countsTowardRate?: boolean;
  stopSell?: CancellationStopSellSnapshot;
}

export interface CancellationUser {
  id: string;
  name: string;
  email?: string;
}

export interface CancellationBooking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  refundStatus?: string | null;
  refundAmount?: number | null;
  grossAmount?: number | null;
  currency?: string | null;
  travelDate?: string | null;
  selectedTime?: string | null;
  cancellationCode?: string | null;
  cancellationCategory?: string | null;
  cancellationOrigin?: string | null;
  countsTowardRate?: boolean | null;
  cancellationFee?: number | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancellationChoiceDeadline?: string | null;
  customerChoice?: string | null;
  customer?: CancellationUser | null;
}

export interface CancellationTour {
  id: string;
  title: string;
  supplier?: { id: string; name: string } | null;
}

export interface CancellationRequest {
  id: string;
  status: CancellationStatus;
  bookingId: string;
  booking?: CancellationBooking | null;
  tour?: CancellationTour | null;
  supplier?: CancellationUser | null;
  payload?: CancellationPayload | null;
  preview?: CancellationPreview | null;
  stopSellingApplied?: boolean;
  batchId?: string | null;
  decidedBy?: CancellationUser | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  reminderCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CancellationPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export interface CancellationListResponse {
  requests: CancellationRequest[];
  pendingCount: number;
  pagination: CancellationPagination;
}

export interface CancellationListParams {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ApproveResult {
  booking: CancellationBooking;
  cancellation: {
    refundStatus?: string | null;
    refundAmount?: number | null;
    refundExecuted?: boolean | null;
    fee?: number | null;
    countsTowardRate?: boolean | null;
    choiceDeadline?: string | null;
  };
  request: CancellationRequest;
}

export interface BatchApproveResultItem {
  id: string;
  ok: boolean;
  bookingId?: string;
  error?: string;
}

export interface BatchApproveResult {
  requested: number;
  approved: number;
  failed: number;
  results: BatchApproveResultItem[];
}

export const getCancellationRequests = (params: CancellationListParams = {}) =>
  api
    .get("/admin/cancellation-requests", { params })
    .then((r) => r.data?.data as CancellationListResponse);

export const getCancellationRequest = (id: string) =>
  api
    .get(`/admin/cancellation-requests/${id}`)
    .then((r) => r.data?.data?.request as CancellationRequest);

export const approveCancellationRequest = (id: string, body: { note?: string } = {}) =>
  api
    .post(`/admin/cancellation-requests/${id}/approve`, body)
    .then((r) => r.data?.data as ApproveResult);

export const rejectCancellationRequest = (id: string, body: { note: string }) =>
  api
    .post(`/admin/cancellation-requests/${id}/reject`, body)
    .then((r) => r.data?.data?.request as CancellationRequest);

export const batchApproveCancellationRequests = (body: { ids: string[]; note?: string }) =>
  api
    .post("/admin/cancellation-requests/batch-approve", body)
    .then((r) => r.data?.data as BatchApproveResult);

/** Extract a human message from an axios error (server `message` first). */
export function getCancellationErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    message?: string;
    response?: { status?: number; data?: { message?: string; error?: { message?: string } } };
  };
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error?.message ||
    e?.message ||
    fallback
  );
}

/** HTTP status of an axios error, if any (used to detect 409 conflicts). */
export function getCancellationErrorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}
