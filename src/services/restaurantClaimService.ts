import api from "@/lib/axios";

/**
 * Restaurant venue claims — admin moderation queue.
 *
 * These routes are mounted on the shared `/api/admin/restaurant-venues`
 * router, not the Ghana-branded `/api/travioghana/admin/*` router. The axios
 * interceptor has an explicit bypass for this prefix.
 */

export type RestaurantClaimStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RestaurantClaimAction = "approve" | "reject";

export interface RestaurantClaim {
  id: string;
  venueId: string;
  userId: string;
  brand: string;
  businessName: string | null;
  role: string | null;
  contactEmail: string;
  phone: string | null;
  message: string | null;
  evidenceUrl: string | null;
  status: RestaurantClaimStatus;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  venueName: string | null;
  venueSlug: string | null;
  venueCity: string | null;
  claimantName: string | null;
  claimantEmail: string | null;
}

export interface RestaurantClaimPagination {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface RestaurantClaimList {
  claims: RestaurantClaim[];
  pagination: RestaurantClaimPagination;
}

export interface ListRestaurantClaimsParams {
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
}

export interface ResolveRestaurantClaimInput {
  claimId: string;
  action: RestaurantClaimAction;
  note?: string;
}

export const RESTAURANT_CLAIMS_QUERY_KEY = ["admin", "restaurant-claims"] as const;

export function listPendingRestaurantClaims({
  limit = 20,
  cursor,
  signal,
}: ListRestaurantClaimsParams = {}): Promise<RestaurantClaimList> {
  const params: Record<string, string | number> = { limit };
  if (cursor) params.cursor = cursor;

  return api
    .get("/admin/restaurant-venues/claims/pending", { params, signal })
    .then((response) => response.data?.data as RestaurantClaimList);
}

export function resolveRestaurantClaim({
  claimId,
  action,
  note,
}: ResolveRestaurantClaimInput): Promise<RestaurantClaim> {
  const body: { action: RestaurantClaimAction; note?: string } = { action };
  const trimmedNote = note?.trim();
  if (trimmedNote) body.note = trimmedNote;

  return api
    .patch(
      `/admin/restaurant-venues/claims/${encodeURIComponent(claimId)}`,
      body,
      // The page already shows a mutation-specific toast, so the interceptor
      // should not add a second one for the same failure.
      { skipGlobalErrorHandler: true },
    )
    .then((response) => response.data?.data?.claim as RestaurantClaim);
}

/** Server message first, so a 409 ("already reviewed") stays meaningful. */
export function getRestaurantClaimErrorMessage(error: unknown, fallback: string): string {
  const e = error as {
    message?: string;
    response?: { data?: { message?: string; error?: { message?: string } } };
  };
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error?.message ||
    e?.message ||
    fallback
  );
}

export function getRestaurantClaimErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
