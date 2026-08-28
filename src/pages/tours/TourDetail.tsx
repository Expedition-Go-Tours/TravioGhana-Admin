import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, ChevronRight, ChevronLeft, Star, Eye, Calendar, DollarSign,
  Clock, Users, Shield, Globe, Check, X, Camera, MapPin, Bed, UtensilsCrossed,
  MoonStar, Ticket, Lock, Headphones, BookOpen, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionError } from "@/components/shared/SectionError";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { PickupZoneMap } from "@/components/shared/PickupZoneMap";
import api from "@/lib/axios";
import { cn, formatCurrency, formatNumber, formatDate, formatTime } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { reviewTour, reviewTourDraft } from "@/services/tourService";
import { toast } from "sonner";

/* ── Types ── */

interface LocationStop {
  day?: number;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  region?: string;
  description?: string;
  timeSpent?: number | null;
  timeSpentUnit?: string;
  admissionIncluded?: string;
}

interface DayLogistics {
  accommodation?: string | null;
  meals?: { type?: string; format?: string }[];
  drinksIncluded?: boolean;
}

interface BookingOption {
  id?: string;
  title?: string;
  refCode?: string;
  description?: string;
  isPrivate?: boolean;
  skipTheLine?: string;
  audioGuide?: boolean;
  infoBooklet?: boolean;
  maxGroupSize?: number | null;
  validityType?: string;
  validity?: number | null;
  validityUnit?: string | null;
}

interface PriceTier { from?: number | null; to?: number | null; pricePerPerson?: number | null; }

interface PricingCategory {
  name?: string;
  price?: number | null;
  minAge?: number;
  maxAge?: number;
  idRequired?: boolean;
  idType?: string;
  tiers?: PriceTier[];
}

interface SupplierInfo { id?: string; name?: string; email?: string; photoURL?: string | null; }

interface ExpeditionTour {
  isActive: boolean;
  bookingFlow: "DIRECT" | "EXTERNAL";
  externalUrl: string | null;
  syncStatus: string | null;
  lastSyncAt: string | null;
  publishedAt: string | null;
}

interface TourDetail {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  photos?: string[];
  coverPhoto?: string;
  currency?: string;
  createdAt?: string;
  draftStatus?: string | null;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  durationStr?: string;
  accommodationIncluded?: boolean;
  locations: LocationStop[];
  dayLogistics: Record<string, DayLogistics>;
  options: BookingOption[];
  highlights?: string[];
  included?: string[];
  excluded?: string[];
  whatToBring?: string[];
  knowBeforeYouGo?: string;
  foodProvided?: boolean;
  meals?: { type?: string; format?: string }[];
  drinksIncluded?: boolean;
  dietaryOptions?: string[];
  meetingMode?: string;
  meetingPoint?: { name?: string; address?: string } | null;
  meetingPointPicture?: string;
  pickupAreas?: { name?: string; address?: string; time?: string; polygon?: [number, number][]; exclusions?: [number, number][][] }[];
  pickupLocations?: { name?: string; address?: string }[];
  dropoffOption?: string;
  dropoffLocation?: { name?: string; address?: string } | null;
  isPrivateActivity?: boolean;
  scheduleType?: string;
  operatingDays?: string[];
  timeSlots?: Array<string | { startTime?: string; endTime?: string }>;
  capacityPerSlot?: number | null;
  validPeriod?: { start?: string; end?: string | null } | null;
  pricingModel?: string;
  pricingApproach?: string;
  pricingCategories: PricingCategory[];
  uniformPrice?: number | null;
  cancellationPolicy?: { label?: string } | null;
  instantBooking?: boolean;
  instantConfirmation?: boolean;
  maxParticipants?: number | null;
  ticketType?: string;
  supplier?: SupplierInfo | null;
  expeditionTour?: ExpeditionTour | null;
  bookingCount?: number;
  totalRevenue?: number;
  averageRating?: number;
  reviewCount?: number;
  viewCount?: number;
}

/* ── Helpers ── */

const ADMISSION_LABELS: Record<string, string> = { yes: "Admission included", no: "Pay separately", passby: "Pass by" };

const ACCOMMODATION_LABELS: Record<string, string> = {
  budget: "Budget hotel (2 stars)",
  midrange: "Midrange hotel (3 stars)",
  premium: "Premium hotel (4–5 stars)",
};

function formatDurationValue(value?: number | null, unit?: string | null): string {
  if (value == null) return "";
  if (unit === "days") return `${value} day${value === 1 ? "" : "s"}`;
  if (unit === "hours") return `${value} hour${value === 1 ? "" : "s"}`;
  if (unit === "minutes") return `${value} min`;
  return unit ? `${value} ${unit}` : String(value);
}

function formatStopDuration(loc: LocationStop): string | null {
  if (loc?.timeSpent == null) return null;
  const n = Number(loc.timeSpent);
  if (loc.timeSpentUnit === "hours") return `${n} hour${n === 1 ? "" : "s"}`;
  return `${n} min`;
}

function stopTitle(loc: LocationStop): string {
  return (loc.name && String(loc.name).trim()) ? loc.name : (loc.address || "Stop");
}

function validityLabel(option: BookingOption): string | null {
  const v = option?.validityType;
  if (v === "open_ended") return "Valid anytime";
  if (v === "from_activation") return `Valid ${option.validity || 1} ${option.validityUnit || "days"} from first use`;
  if (v === "period") return `Valid ${option.validity || 1} ${option.validityUnit || "days"} from booking`;
  if (v === "date_picked") return "Valid on selected date";
  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const p = JSON.parse(value); if (Array.isArray(p)) return p; } catch { /* noop */ }
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try { const p = JSON.parse(value); if (p && typeof p === "object" && !Array.isArray(p)) return p; } catch { /* noop */ }
  }
  return {};
}

function normalizeTour(raw: Record<string, unknown>): TourDetail {
  const categorization = asObject(raw.categorization);
  const productContent = asObject(raw.productContent);
  const schedulesAndPricing = asObject(raw.schedulesAndPricing);
  const pricingSchedules = asObject(schedulesAndPricing.pricingSchedules);
  const schedules = asArray(pricingSchedules.schedules);
  const firstSchedule = asObject(schedules[0]);
  const travelerDetails = asObject(schedulesAndPricing.travelerDetails);
  const availability = asObject(schedulesAndPricing.availability);
  const bookingAndTickets = asObject(raw.bookingAndTickets);

  const durationObj = asObject(categorization.duration);
  const durationValue = typeof durationObj.value === "number" ? durationObj.value : undefined;
  const durationUnit = typeof durationObj.unit === "string" ? durationObj.unit : undefined;

  const rawLocations = asArray(productContent.locations).map((l) => asObject(l) as unknown as LocationStop);
  const locations = rawLocations.map((l) => ({ ...l, day: typeof l.day === "number" ? l.day : 1 }));

  const dayLogisticsRaw = asObject(productContent.dayLogistics);
  const dayLogistics: Record<string, DayLogistics> = {};
  for (const [k, v] of Object.entries(dayLogisticsRaw)) {
    const d = asObject(v);
    dayLogistics[k] = {
      accommodation: typeof d.accommodation === "string" ? d.accommodation : null,
      meals: asArray(d.meals).map((m) => asObject(m) as { type?: string; format?: string }),
      drinksIncluded: !!d.drinksIncluded,
    };
  }

  const options = asArray(productContent.options).map((o) => asObject(o) as unknown as BookingOption);

  const pricingCats = (asArray(travelerDetails.pricingCategories)).map((c) => asObject(c) as unknown as PricingCategory);
  const pricingCategories: PricingCategory[] = pricingCats.map((c) => ({
    name: typeof c.name === "string" ? c.name : undefined,
    price: typeof c.price === "number" ? c.price : null,
    minAge: typeof c.minAge === "number" ? c.minAge : undefined,
    maxAge: typeof c.maxAge === "number" ? c.maxAge : undefined,
    idRequired: !!c.idRequired,
    idType: typeof c.idType === "string" ? c.idType : undefined,
    tiers: asArray(c.tiers).map((t) => asObject(t) as unknown as PriceTier),
  }));

  const meetingPointRaw = (bookingAndTickets.meetingPoint ?? productContent.meetingPoint) as unknown;
  const meetingPoint = asObject(meetingPointRaw);
  const dropoffLocation = asObject(productContent.dropoffLocation);

  const supplierRaw = asObject(raw.supplier);
  const expeditionRaw = asObject(raw.expeditionTour);

  const count = asObject(raw._count);

  return {
    ...(raw as unknown as TourDetail),
    id: String(raw.id ?? ""),
    title: typeof raw.title === "string" ? raw.title : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    photos: asArray(raw.photos).filter((p): p is string => typeof p === "string"),
    coverPhoto: typeof raw.coverPhoto === "string" ? raw.coverPhoto : undefined,
    currency: typeof pricingSchedules.currency === "string" ? pricingSchedules.currency : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    draftStatus: (typeof raw.draftStatus === "string" ? raw.draftStatus : null) as string | null,
    category: (typeof categorization.category === "string" ? categorization.category : undefined) || (typeof raw.category === "string" ? raw.category : undefined),
    subcategory: typeof categorization.subcategory === "string" ? categorization.subcategory : undefined,
    difficulty: (typeof categorization.difficulty === "string" ? categorization.difficulty : undefined) || (typeof raw.difficulty === "string" ? raw.difficulty : undefined),
    durationStr: formatDurationValue(durationValue, durationUnit) || undefined,
    accommodationIncluded: categorization.accommodationIncluded === true,
    locations,
    dayLogistics,
    options,
    highlights: asArray(productContent.highlights).filter((h): h is string => typeof h === "string"),
    included: (asArray(productContent.included).filter((i): i is string => typeof i === "string")),
    excluded: (asArray(productContent.excluded).filter((i): i is string => typeof i === "string")),
    whatToBring: asArray(productContent.whatToBring).filter((i): i is string => typeof i === "string"),
    knowBeforeYouGo: typeof productContent.knowBeforeYouGo === "string" ? productContent.knowBeforeYouGo : undefined,
    foodProvided: productContent.foodProvided === true,
    meals: asArray(productContent.meals).map((m) => asObject(m) as { type?: string; format?: string }),
    drinksIncluded: productContent.drinksIncluded === true,
    dietaryOptions: asArray(productContent.dietaryOptions).filter((i): i is string => typeof i === "string"),
    meetingMode: typeof productContent.meetingMode === "string" ? productContent.meetingMode : undefined,
    meetingPoint: (meetingPoint.name || meetingPoint.address) ? { name: meetingPoint.name as string, address: meetingPoint.address as string } : null,
    meetingPointPicture: typeof productContent.meetingPointPicture === "string" ? productContent.meetingPointPicture : undefined,
    pickupAreas: asArray(productContent.pickupAreas).map((a) => asObject(a) as { name?: string; address?: string; time?: string; polygon?: [number, number][]; exclusions?: [number, number][][] }),
    pickupLocations: asArray(productContent.pickupLocations).map((a) => asObject(a) as { name?: string; address?: string }),
    dropoffOption: typeof productContent.dropoffOption === "string" ? productContent.dropoffOption : undefined,
    dropoffLocation: (dropoffLocation.name || dropoffLocation.address) ? { name: dropoffLocation.name as string, address: dropoffLocation.address as string } : null,
    isPrivateActivity: productContent.isPrivateActivity === true,
    scheduleType: typeof availability.scheduleType === "string" ? availability.scheduleType : undefined,
    operatingDays: asArray(availability.daysOfWeek).filter((d): d is string => typeof d === "string"),
    timeSlots: asArray(Array.isArray(firstSchedule.timeSlots) && firstSchedule.timeSlots.length > 0 ? firstSchedule.timeSlots : availability.timeSlots) as Array<string | { startTime?: string; endTime?: string }>,
    capacityPerSlot: typeof travelerDetails.maxParticipants === "number" ? travelerDetails.maxParticipants : null,
    validPeriod: firstSchedule.startDate ? { start: String(firstSchedule.startDate), end: firstSchedule.endDate ? String(firstSchedule.endDate) : null } : null,
    pricingModel: typeof travelerDetails.pricingModel === "string" ? travelerDetails.pricingModel : undefined,
    pricingApproach: typeof travelerDetails.pricingApproach === "string" ? travelerDetails.pricingApproach : undefined,
    pricingCategories,
    uniformPrice: typeof travelerDetails.uniformPrice === "number" ? travelerDetails.uniformPrice : null,
    cancellationPolicy: (bookingAndTickets.cancellationPolicy ? { label: (asObject(bookingAndTickets.cancellationPolicy).label as string) || undefined } : null),
    instantBooking: bookingAndTickets.instantBooking === true,
    instantConfirmation: bookingAndTickets.instantConfirmation === true,
    maxParticipants: typeof bookingAndTickets.maxQuantity === "number" ? bookingAndTickets.maxQuantity : null,
    ticketType: typeof bookingAndTickets.ticketType === "string" ? bookingAndTickets.ticketType : undefined,
    supplier: (supplierRaw.id || supplierRaw.name) ? {
      id: typeof supplierRaw.id === "string" ? supplierRaw.id : undefined,
      name: typeof supplierRaw.name === "string" ? supplierRaw.name : undefined,
      email: typeof supplierRaw.email === "string" ? supplierRaw.email : undefined,
      photoURL: typeof supplierRaw.photoURL === "string" ? supplierRaw.photoURL : null,
    } : null,
    expeditionTour: expeditionRaw.isActive !== undefined ? {
      isActive: expeditionRaw.isActive === true,
      bookingFlow: expeditionRaw.bookingFlow === "EXTERNAL" ? "EXTERNAL" : "DIRECT",
      externalUrl: (expeditionRaw.externalUrl as string) || null,
      syncStatus: (expeditionRaw.syncStatus as string) || null,
      lastSyncAt: (expeditionRaw.lastSyncAt as string) || null,
      publishedAt: (expeditionRaw.publishedAt as string) || null,
    } : null,
    bookingCount: (count.bookings as number) ?? (typeof raw.totalBookings === "number" ? raw.totalBookings : undefined),
    totalRevenue: typeof raw.totalRevenue === "number" ? raw.totalRevenue : undefined,
    averageRating: typeof raw.averageRating === "number" ? raw.averageRating : undefined,
    reviewCount: (count.reviews as number) ?? (typeof raw.reviewCount === "number" ? raw.reviewCount : undefined),
    viewCount: typeof raw.viewCount === "number" ? raw.viewCount : undefined,
  };
}

/* ── Sub-components ── */

function SectionCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("bg-surface-base rounded-xl border border-border/60 shadow-sm shadow-black/5 overflow-hidden hover:shadow-md hover:shadow-black/5 hover:border-border transition-all duration-200", className)}
    >
      {title && (
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-4 bg-linear-to-b from-emerald-500 to-emerald-300 rounded-full shrink-0" />
            <h2 className="text-sm font-semibold text-text-primary tracking-tight flex-1">{title}</h2>
          </div>
        </div>
      )}
      <div className={cn("px-5 py-4", !title && "p-5")}>{children}</div>
    </motion.div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-text-tertiary shrink-0" />
        <span className="text-[11px] text-text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-sm font-medium text-text-primary break-words leading-snug min-w-0">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: "emerald" | "blue" | "amber" }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  const a = map[accent || "emerald"];
  return (
    <div className="flex items-center gap-3 bg-surface-base rounded-xl border border-border/60 px-4 py-3.5 shadow-sm shadow-black/5 hover:shadow-md hover:border-border transition-all duration-200">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-border/50", a)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-base font-bold text-text-primary leading-none tabular-nums truncate">{value}</p>
        <p className="text-xs text-text-tertiary font-medium leading-tight mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const queryClient = useQueryClient();

  const { data: tour, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "tour-detail", id, "v2"],
    queryFn: async () => {
      const unwrap = (res: { data: unknown }) => {
        const body = res.data as { data?: { tour?: Record<string, unknown> }; tour?: Record<string, unknown> };
        const t = body?.data?.tour ?? body?.tour ?? (body as Record<string, unknown>);
        if (!t) throw new Error("Tour not found");
        return normalizeTour(t);
      };
      try {
        const res = await api.get(`/admin/tours/${id}`);
        return unwrap(res);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          const res = await api.get(`/tours/${id}`);
          return unwrap(res);
        }
        throw err;
      }
    },
    enabled: !!id,
  });

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isPendingApproval = tour?.status === "PENDING_APPROVAL";
  const isPendingEdits = tour?.status === "ACTIVE" && tour?.draftStatus === "PENDING_APPROVAL";
  const canModerate = can("tours.approve");

  const reviewMutation = useMutation({
    mutationFn: ({ action, reason }: { action: "approve" | "flag"; reason?: string }) =>
      isPendingEdits ? reviewTourDraft(id!, { action, reason }) : reviewTour(id!, { action, reason }),
    onSuccess: () => {
      toast.success("Tour updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "tour-detail", id] });
      setFlagOpen(false);
      setFlagReason("");
    },
    onError: (err: Error) => toast.error(err.message || "Action failed"),
  });

  const allPhotos = useMemo(() => {
    const set = new Set<string>();
    if (tour?.coverPhoto) set.add(tour.coverPhoto);
    tour?.photos?.forEach((p) => set.add(p));
    return [...set];
  }, [tour]);

  const normalizedPrices = useMemo(() => {
    if (!tour) return [];
    const cats = tour.pricingCategories || [];
    if (cats.length === 0) return [];
    const uniform = tour.uniformPrice;
    return cats.map((c) => ({
      label: c.name || "Standard",
      price: Number(uniform ?? c.price ?? 0),
      tiers: c.tiers || [],
      minAge: c.minAge,
      maxAge: c.maxAge,
      idRequired: c.idRequired,
      idType: c.idType,
    }));
  }, [tour]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) return <SectionError message="Failed to load tour details" onRetry={() => refetch()} />;
  if (!tour) return <div className="py-12 text-center text-sm text-text-tertiary">Tour not found</div>;

  const displayPhotos = allPhotos;

  // Itinerary day grouping
  const locations = tour.locations ?? [];
  const days: Record<number, LocationStop[]> = {};
  locations.forEach((loc) => {
    const d = loc.day ?? 1;
    if (!days[d]) days[d] = [];
    days[d].push(loc);
  });
  const dayKeys = Object.keys(days).map(Number).sort((a, b) => a - b);
  const isMultiDay = dayKeys.length > 1 || locations.some((l) => (l.day ?? 1) > 1);

  return (
    <div className="min-h-screen bg-surface-muted/80">
      {/* Sticky header */}
      <div className="bg-surface-base shadow-sm shadow-black/5 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-text-tertiary hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all shrink-0">
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Tours</span>
              </button>
              <span className="text-xs text-border shrink-0">/</span>
              <h1 className="text-sm font-semibold text-text-primary truncate">{tour.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={tour.status || "UNKNOWN"} />
              {canModerate && (isPendingApproval || isPendingEdits) && (
                <>
                  <Button
                    size="sm"
                    onClick={() => reviewMutation.mutate({ action: "approve" })}
                    disabled={reviewMutation.isPending}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isPendingEdits ? "Approve edits" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlagOpen(true)}
                    disabled={reviewMutation.isPending}
                    className="h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <Flag size={13} className="mr-1" /> Flag
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {/* Hero gallery */}
        {displayPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-1 rounded-xl overflow-hidden shadow-sm shadow-black/5">
              {displayPhotos.slice(0, 5).map((photo, i) => {
                const hasMore = displayPhotos.length > 5 && i === 4;
                return (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className={cn("relative overflow-hidden bg-surface-muted group cursor-pointer", i === 0 ? "md:col-span-2 md:row-span-2 min-h-[260px] md:min-h-[440px]" : "min-h-[130px] md:min-h-[219px]")}
                  >
                    <OptimizedImage src={photo} width={i === 0 ? 2400 : 600} alt={`Photo ${i + 1}`} className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105" />
                    {i === 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <Camera size={12} /> <span>View all {displayPhotos.length} photos</span>
                      </div>
                    )}
                    {hasMore && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white/90 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">+{displayPhotos.length - 5} more</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Performance stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
          {can("bookings.view") && (
            <StatCard label="Bookings" value={tour.bookingCount != null ? formatNumber(tour.bookingCount) : "—"} icon={<Calendar size={17} />} accent="blue" />
          )}
          {can("analytics.view") && (
            <StatCard label="Revenue" value={tour.totalRevenue != null ? formatCurrency(tour.totalRevenue, tour.currency) : "—"} icon={<DollarSign size={17} />} accent="emerald" />
          )}
          <StatCard label="Reviews" value={tour.reviewCount != null ? formatNumber(tour.reviewCount) : "—"} icon={<Star size={17} />} accent="amber" />
          <StatCard label="Rating" value={tour.averageRating != null ? Number(tour.averageRating).toFixed(1) : "—"} icon={<Star size={17} />} accent="amber" />
          {can("analytics.view") && (
            <StatCard label="Views" value={tour.viewCount != null ? formatNumber(tour.viewCount) : "—"} icon={<Eye size={17} />} accent="emerald" />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-5">
            {tour.description && (
              <SectionCard title="Description">
                <p className="text-sm text-text-secondary leading-relaxed">{tour.description}</p>
              </SectionCard>
            )}

            {tour.highlights && tour.highlights.length > 0 && (
              <SectionCard title="Highlights">
                <ul className="space-y-2.5">
                  {tour.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={10} className="text-emerald-500" />
                      </div>
                      <span className="min-w-0 break-words">{h}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Itinerary */}
            {locations.length > 0 && (
              <SectionCard title="Itinerary">
                <div className="space-y-5">
                  {dayKeys.map((dayNum) => {
                    const stops = days[dayNum];
                    const logistics = (tour.dayLogistics ?? {})[String(dayNum)];
                    return (
                      <div key={dayNum}>
                        {isMultiDay && (
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Day {dayNum}</span>
                            {logistics?.accommodation && (
                              <span className="flex items-center gap-1 text-xs text-text-tertiary"><Bed size={12} className="text-text-tertiary" /> {ACCOMMODATION_LABELS[logistics.accommodation] || logistics.accommodation}</span>
                            )}
                            {logistics?.meals && logistics.meals.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-text-tertiary"><UtensilsCrossed size={12} className="text-text-tertiary" /> {logistics.meals.map((m) => `${m.type}${m.format ? ` (${m.format})` : ""}`).join(", ")}</span>
                            )}
                            {logistics?.drinksIncluded && <span className="text-xs text-text-tertiary">· Drinks included</span>}
                          </div>
                        )}
                        <div className="space-y-2.5">
                          {stops.map((loc, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-surface-muted text-text-secondary text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-text-primary">{stopTitle(loc)}</p>
                                  {formatStopDuration(loc) && <span className="text-xs text-text-tertiary shrink-0">{formatStopDuration(loc)}</span>}
                                </div>
                                {(loc.city || loc.country) && (
                                  <p className="text-xs text-text-tertiary mt-0.5">{[loc.city, loc.country].filter(Boolean).join(", ")}</p>
                                )}
                                {loc.admissionIncluded && (
                                  <p className="text-[11px] text-text-tertiary mt-0.5">{ADMISSION_LABELS[loc.admissionIncluded]}</p>
                                )}
                                {loc.description && <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{loc.description}</p>}
                              </div>
                            </div>
                          ))}
                          {isMultiDay && (
                            <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary pl-9">
                              <MoonStar size={12} className="text-amber-500" />
                              Overnight in {stopTitle(stops[stops.length - 1])}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Included / Excluded */}
            {(tour.included && tour.included.length > 0) || (tour.excluded && tour.excluded.length > 0) || tour.foodProvided || (tour.meals && tour.meals.length > 0) || tour.drinksIncluded || (tour.dietaryOptions && tour.dietaryOptions.length > 0) ? (
              <SectionCard title="What's Included">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                  {tour.included && tour.included.length > 0 && (
                    <div className="pb-4 sm:pb-0 sm:pr-6">
                      <h3 className="text-xs font-medium text-text-tertiary mb-3">Included</h3>
                      <ul className="space-y-2.5">
                        {tour.included.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                            <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5"><Check size={10} className="text-emerald-500" /></div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tour.excluded && tour.excluded.length > 0 && (
                    <div className="pt-4 sm:pt-0 sm:pl-6">
                      <h3 className="text-xs font-medium text-text-tertiary mb-3">Excluded</h3>
                      <ul className="space-y-2.5">
                        {tour.excluded.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                            <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5"><X size={10} className="text-red-400" /></div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {(tour.foodProvided || (tour.meals && tour.meals.length > 0) || tour.drinksIncluded || (tour.dietaryOptions && tour.dietaryOptions.length > 0)) && (
                  <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                    {tour.foodProvided && <p className="text-sm text-text-secondary"><span className="font-medium">Meals:</span> {tour.meals?.map((m) => `${m.type} (${m.format})`).join(", ") || "Provided"}</p>}
                    {tour.drinksIncluded && <p className="text-sm text-text-secondary"><span className="font-medium">Drinks:</span> Included</p>}
                    {tour.dietaryOptions && tour.dietaryOptions.length > 0 && <p className="text-sm text-text-secondary"><span className="font-medium">Dietary options:</span> {tour.dietaryOptions.join(", ")}</p>}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {tour.whatToBring && tour.whatToBring.length > 0 && (
              <SectionCard title="What to Bring">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tour.whatToBring.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-surface-muted text-sm text-text-secondary">
                      <Check size={12} className="text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {tour.knowBeforeYouGo && (
              <SectionCard title="What to Know">
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{tour.knowBeforeYouGo}</p>
              </SectionCard>
            )}

            {tour.meetingMode && tour.meetingMode !== "none" && (
              <SectionCard title="Meeting & Pickup">
                <div className="space-y-3 text-sm text-text-secondary">
                  {tour.meetingMode === "meeting_point" && tour.meetingPoint && (
                    <p><span className="font-medium text-text-primary">Meeting point:</span> {[tour.meetingPoint.name, tour.meetingPoint.address].filter(Boolean).join(", ")}</p>
                  )}
                  {tour.meetingMode === "pickup" && ((tour.pickupAreas ?? []).length > 0 || (tour.pickupLocations ?? []).length > 0) && (
                    <div>
                      <span className="font-medium text-text-primary">Pickup:</span>
                      <ul className="mt-1 space-y-1">
                        {[...(tour.pickupAreas ?? []), ...(tour.pickupLocations ?? [])].map((p0, i) => {
                          const p = p0 as { name?: string; address?: string; time?: string; polygon?: [number, number][]; exclusions?: [number, number][][] }
                          const hasZone = Array.isArray(p.polygon) && p.polygon.length >= 3
                          const exclusionCount = Array.isArray(p.exclusions) ? p.exclusions.length : 0
                          return (
                            <li key={i} className="text-text-tertiary">
                              <span>{[p.name, p.address].filter(Boolean).join(", ") || "—"}</span>
                              {p.time && <span className="ml-2 text-[11px] text-text-tertiary">pickup {p.time}</span>}
                              {hasZone && (
                                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">zone</span>
                              )}
                              {exclusionCount > 0 && (
                                <span className="ml-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                                  {exclusionCount} no-pickup
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {(tour.pickupAreas ?? []).some((a) => Array.isArray(a.polygon) && a.polygon.length >= 3) && (
                        <div className="mt-3">
                          <PickupZoneMap areas={tour.pickupAreas ?? []} height={240} />
                        </div>
                      )}
                    </div>
                  )}
                  {tour.dropoffOption && tour.dropoffOption !== "none" && (
                    <p>
                      <span className="font-medium text-text-primary">Drop-off:</span>{" "}
                      {tour.dropoffOption === "same_location" ? "Same as meeting point" : tour.dropoffLocation ? [tour.dropoffLocation.name, tour.dropoffLocation.address].filter(Boolean).join(", ") : "Different location"}
                    </p>
                  )}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-5">
            {/* Supplier */}
            {can("suppliers.view") && tour.supplier && (
              <SectionCard title="Supplier">
                <button
                  type="button"
                  onClick={() => {
                    if (tour.supplier?.id) navigate(`/admin/suppliers/${tour.supplier.id}`);
                  }}
                  disabled={!tour.supplier.id}
                  className="group flex w-full items-center gap-3 text-left rounded-lg transition-all disabled:cursor-default"
                >
                  {tour.supplier.photoURL ? (
                    <OptimizedImage src={tour.supplier.photoURL} alt="" width={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-text-secondary">{tour.supplier.name?.charAt(0)?.toUpperCase() || "?"}</div>
                  )}
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium text-text-primary", tour.supplier.id && "hover:text-emerald-700")}>{tour.supplier.name || "Unknown"}</p>
                    {tour.supplier.email && <p className="text-xs text-text-tertiary truncate">{tour.supplier.email}</p>}
                  </div>
                  {tour.supplier.id && (
                    <ChevronRight size={14} className="ml-auto shrink-0 text-border group-hover:text-emerald-600 transition-colors" />
                  )}
                </button>
              </SectionCard>
            )}

            {/* Pricing */}
            <SectionCard title="Pricing">
              <div className="space-y-3">
                {tour.currency && <span className="text-xs font-medium text-text-tertiary bg-surface-muted px-2 py-0.5 rounded-md">{tour.currency}</span>}
                {normalizedPrices.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text-secondary">{tour.pricingModel === "perGroup" ? "Per group" : "Per person"}</span>
                      {tour.pricingApproach === "sameForEveryone" && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-600">Same for everyone</span>}
                      {tour.pricingApproach === "dependsOnAge" && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-600">Depends on age</span>}
                    </div>
                    <div className="divide-y divide-border/40">
                      {normalizedPrices.map((price, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm text-text-primary font-medium">{price.label}</span>
                              {(price.minAge != null || price.maxAge != null) && <span className="text-xs text-text-tertiary">({price.minAge}–{price.maxAge})</span>}
                            </div>
                            <span className="text-sm font-bold text-text-primary tabular-nums shrink-0 ml-3">{formatCurrency(price.price, tour.currency)}</span>
                          </div>
                          {price.tiers && price.tiers.length > 0 && (
                            <div className="ml-3 mb-2 pb-2 border-b border-border/40 last:border-b-0">
                              <div className="space-y-1">
                                {price.tiers.map((tier, ti) => (
                                  <div key={ti} className="flex items-center justify-between text-xs pl-3 py-1 rounded bg-surface-muted/50 px-2">
                                    <span className="text-text-tertiary">{tier.from ?? "1"}–{tier.to ?? "∞"} people</span>
                                    <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(tier.pricePerPerson ?? 0, tour.currency)} each</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {tour.validPeriod && (
                      <div className="pt-3 mt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-tertiary">Valid period</span>
                          <span className="font-medium text-text-tertiary">{tour.validPeriod.start ? formatDate(tour.validPeriod.start) : ""}{tour.validPeriod.end ? ` – ${formatDate(tour.validPeriod.end)}` : ""}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-tertiary">No pricing configured</p>
                )}
              </div>
            </SectionCard>

            {/* Schedule */}
            {(tour.scheduleType || (tour.operatingDays && tour.operatingDays.length > 0) || (tour.timeSlots && tour.timeSlots.length > 0)) && (
              <SectionCard title="Schedule">
                <div className="space-y-4">
                  {tour.scheduleType && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text-secondary">
                      {tour.scheduleType === "operatingHours" ? "Operating Hours" : "Fixed Time Slot"}
                    </span>
                  )}
                  {tour.operatingDays && tour.operatingDays.length > 0 && (
                    <div>
                      <p className="text-xs text-text-tertiary mb-2">Operating Days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tour.operatingDays.map((day) => (
                          <span key={day} className="text-xs px-2.5 py-1 rounded-md bg-surface-muted text-text-tertiary font-medium border border-border/60 capitalize">{day.slice(0, 3)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tour.timeSlots && tour.timeSlots.length > 0 && (
                    <div>
                      <p className="text-xs text-text-tertiary mb-2">Time Slots</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tour.timeSlots.map((slot, i) => {
                          const start = typeof slot === "string" ? slot : slot.startTime;
                          const end = typeof slot === "string" ? undefined : slot.endTime;
                          return <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-surface-muted text-text-tertiary font-medium border border-border/60">{formatTime(start)}{end ? ` – ${formatTime(end)}` : ""}</span>;
                        })}
                      </div>
                    </div>
                  )}
                  {tour.capacityPerSlot != null && (
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <Users size={13} /> Max per booking: <strong className="text-text-primary">{tour.capacityPerSlot}</strong>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Details */}
            <SectionCard title="Details">
              <div className="px-1 py-1">
                <DetailRow icon={Globe} label="Category" value={tour.category ? `${tour.category}${tour.subcategory ? ` / ${tour.subcategory}` : ""}` : null} />
                <DetailRow icon={Clock} label="Duration" value={tour.durationStr} />
                <DetailRow icon={Shield} label="Difficulty" value={tour.difficulty} />
                <DetailRow icon={Users} label="Group Type" value={tour.isPrivateActivity ? "Private" : "Group"} />
                <DetailRow icon={DollarSign} label="Pricing" value={tour.pricingModel === "perGroup" ? "Per group" : "Per person"} />
                <DetailRow icon={MapPin} label="Accommodation" value={tour.accommodationIncluded ? "Included" : "Not included"} />
              </div>
            </SectionCard>

            {/* Booking Options */}
            {(tour.options ?? []).length > 0 && (
              <SectionCard title="Booking Options">
                <div className="space-y-3">
                  {tour.options.map((opt, i) => {
                    const vLabel = validityLabel(opt);
                    return (
                      <div key={opt.id || i} className="rounded-lg border border-border/60 p-4 space-y-2 bg-surface-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-text-primary">{opt.title || `Option ${i + 1}`}</p>
                          {opt.refCode && opt.refCode !== "default" && <span className="text-[11px] text-text-tertiary shrink-0">Ref: {opt.refCode}</span>}
                        </div>
                        {vLabel && <p className="text-xs text-text-tertiary flex items-center gap-1.5"><Ticket size={12} className="text-text-tertiary shrink-0" /> {vLabel}</p>}
                        {opt.description && <p className="text-xs text-text-tertiary leading-relaxed">{opt.description}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {opt.isPrivate && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-50 text-violet-600 border border-violet-200/50"><Lock size={10} /> Private</span>}
                          {opt.skipTheLine && opt.skipTheLine !== "none" && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200/50"><Flag size={10} /> Skip the line</span>}
                          {opt.audioGuide && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/50"><Headphones size={10} /> Audio guide</span>}
                          {opt.infoBooklet && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-600 border border-teal-200/50"><BookOpen size={10} /> Info booklet</span>}
                          {opt.maxGroupSize && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-200/50"><Users size={10} /> Max {opt.maxGroupSize} ppl</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Booking Rules */}
            {(tour.instantBooking !== undefined || tour.instantConfirmation !== undefined || tour.cancellationPolicy || tour.ticketType) && (
              <SectionCard title="Booking Rules">
                <div className="space-y-3 text-sm">
                  {tour.ticketType && (
                    <div className="flex items-center gap-2.5 text-text-secondary">
                      <Ticket size={14} className="text-text-tertiary shrink-0" /> <span>Ticket type: <strong className="text-text-primary">{tour.ticketType}</strong></span>
                    </div>
                  )}
                  {tour.instantBooking !== undefined && (
                    <div className="flex items-center gap-2.5 text-text-secondary">
                      {tour.instantBooking ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Clock size={14} className="text-text-tertiary shrink-0" />}
                      <span>{tour.instantBooking ? "Instant booking" : "Request booking"}</span>
                    </div>
                  )}
                  {tour.instantConfirmation !== undefined && (
                    <div className="flex items-center gap-2.5 text-text-secondary">
                      {tour.instantConfirmation ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Clock size={14} className="text-text-tertiary shrink-0" />}
                      <span>{tour.instantConfirmation ? "Instant confirmation" : "Manual confirmation"}</span>
                    </div>
                  )}
                  {tour.cancellationPolicy?.label && (
                    <div className="flex items-center gap-2.5 text-text-secondary">
                      <Shield size={14} className="text-text-tertiary shrink-0" /> <span>{tour.cancellationPolicy.label}</span>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && displayPhotos[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4" onClick={() => setLightboxIndex(null)}>
          <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }} className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10"><X size={22} /></button>
          {lightboxIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10"><ChevronLeft size={28} /></button>
          )}
          <OptimizedImage src={displayPhotos[lightboxIndex]} alt="" width={1600} className="max-h-[85vh] w-auto max-w-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          {lightboxIndex < displayPhotos.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10"><ChevronRight size={28} /></button>
          )}
        </div>
      )}

      {/* Flag dialog */}
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag tour for changes</DialogTitle>
            <DialogDescription>Tell the supplier what needs to change. A reason is required.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="e.g. Prices look incomplete — please review the adult pricing."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!flagReason.trim()) { toast.error("A reason is required"); return; }
                reviewMutation.mutate({ action: "flag", reason: flagReason.trim() });
              }}
              disabled={reviewMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Flag size={14} className="mr-1" /> Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
