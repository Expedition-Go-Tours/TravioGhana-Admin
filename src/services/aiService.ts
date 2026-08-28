import api from "@/lib/axios";

// ── Types ───────────────────────────────────────────────────────────────

export interface AiTourStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface AiImageStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface AiAttractionStats {
  total: number;
  with_hero_image: number;
  ai_selected: number;
  fallback_image: number;
  manual_override: number;
}

export interface AiCronStatus {
  running: boolean;
  processing: boolean;
  config: {
    intervalMs: number;
    maxToursPerCycle: number;
    delayBetweenMs: number;
    staleThresholdMs: number;
  };
}

export interface AiStatusResponse {
  tours: AiTourStats;
  imageAnalysis: AiImageStats;
  attractions: AiAttractionStats;
  cron: AiCronStatus;
  lastProcessed: { title: string; at: string } | null;
}

export interface AiFailedTour {
  id: string;
  title: string;
  category: string | null;
  city: string | null;
  createdAt: string;
  aiScoredAt: string | null;
}

export interface AiFailedImage {
  id: string;
  tourId: string;
  imageUrl: string;
  aiRetryCount: number;
  aiDescription: string | null;
}

export interface AiFailedResponse {
  tours: AiFailedTour[];
  failedImages: AiFailedImage[];
  tourCount: number;
  imageCount: number;
}

export interface AiRetryResponse {
  message: string;
  enqueued: number;
  tours: { id: string; title: string }[];
}

// ── API Functions ───────────────────────────────────────────────────────

export async function fetchAiStatus(): Promise<AiStatusResponse> {
  const res = await api.get("/admin/ai/status");
  return res.data?.data;
}

export async function fetchAiFailed(): Promise<AiFailedResponse> {
  const res = await api.get("/admin/ai/failed");
  return res.data?.data;
}

export async function retryAiFailed(
  tourIds?: string[]
): Promise<AiRetryResponse> {
  const res = await api.post("/admin/ai/retry", { tourIds });
  return res.data?.data;
}
