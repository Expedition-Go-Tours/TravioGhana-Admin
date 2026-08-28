import api from "@/lib/axios";

export interface ReviewQueueTour {
  id: string;
  title: string;
  description?: string;
  photos?: string[];
  coverPhoto?: string | null;
  status?: string;
  draftStatus?: string | null;
  draftSubmittedAt?: string | null;
  category?: string;
  subcategory?: string;
  city?: string;
  country?: string;
  region?: string;
  price?: number | string | null;
  currency?: string;
  slug?: string;
  tags?: string[];
  difficulty?: string;
  durationMinutes?: number;
  averageRating?: number;
  reviewCount?: number;
  totalBookings?: number;
  viewCount?: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  supplierId?: string;
  supplier?: {
    id?: string;
    name?: string;
    email?: string;
    photoURL?: string | null;
  };
  categorization?: Record<string, unknown> | null;
  productContent?: Record<string, unknown> | null;
  schedulesAndPricing?: Record<string, unknown> | null;
  bookingAndTickets?: Record<string, unknown> | null;
  _count?: { bookings?: number; reviews?: number };
  createdAt?: string;
}

export interface ReviewQueueResponse {
  tours: ReviewQueueTour[];
  counts: { pending: number; rejected: number; active: number; pendingEdits: number };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

export interface TourDraftDiff {
  path: string;
  kind: "changed" | "added" | "removed";
  before?: string;
  after?: string;
}

export interface TourDraftReview {
  tour: {
    id: string;
    title: string;
    status: string;
    draftStatus: string | null;
    draftSubmittedAt: string | null;
    draftReviewNote: string | null;
    supplier: string;
  };
  live: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  diff: TourDraftDiff[];
  changesSummary: { count: number; sections: { section: string; changes: number; paths: string[] }[] };
}

export const getTourReviewQueue = (params?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}) =>
  api
    .get("/admin/tours/review", { params })
    .then((r) => (r.data?.data ? r.data.data : r.data) as ReviewQueueResponse);

export const reviewTour = (id: string, body: { action: "approve" | "flag"; reason?: string }) =>
  api.patch(`/admin/tours/${id}/review`, body).then((r) => {
    if (r.data?.status && r.data.status !== "success") {
      throw new Error(r.data.message || "Request failed");
    }
    return r.data;
  });

export const getTourDraftReview = (id: string) =>
  api
    .get(`/admin/tours/${id}/draft`)
    .then((r) => (r.data?.data ? r.data.data : r.data) as TourDraftReview);

export const reviewTourDraft = (id: string, body: { action: "approve" | "flag"; reason?: string }) =>
  api.patch(`/admin/tours/${id}/draft-review`, body).then((r) => {
    if (r.data?.status && r.data.status !== "success") {
      throw new Error(r.data.message || "Request failed");
    }
    return r.data;
  });

export interface AdminTourSearchResult {
  id: string;
  title: string;
  slug: string;
  coverPhoto: string | null;
  status: string;
  category: string | null;
  city: string | null;
  country: string | null;
  supplierId: string | null;
  supplierName: string | null;
}

/** Search tours across all statuses (title, supplier, category, city, country, reference code). */
export const searchAdminTours = (q: string) =>
  api
    .get("/admin/search/tours", { params: { q } })
    .then((r) => (r.data?.data?.tours || []) as AdminTourSearchResult[]);
