import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  Flag,
  MapPin,
  Clock,
  Users,
  Tag,
  Star,
  Shield,
  Ticket,
  ChevronDown,
  ChevronRight,
  Circle,
  DollarSign,
  Calendar,
  CreditCard,
  Utensils,
  Truck,
  Package,
  BookOpen,
  Phone,
  TrendingUp,
  PawPrint,
  AlertTriangle,
  Plane,
  Hotel,
  Ship,
  Train,
} from 'lucide-react';
import { PhotoGallery } from './PhotoGallery';
import { DiffViewer } from './DiffViewer';
import type { ReviewQueueTour, TourDraftReview } from '@/services/tourService';
import OptimizedImage from "@/components/shared/OptimizedImage";
import { PickupZoneMap } from "@/components/shared/PickupZoneMap";

interface TourDetailPanelProps {
  tour: ReviewQueueTour | null;
  draftReview: TourDraftReview | null;
  onApprove: () => void;
  onFlag: (reason: string) => void;
  isApproving: boolean;
  isFlagging: boolean;
}

interface ItineraryStop {
  day?: number;
  time?: string;
  title?: string;
  activityName?: string;
  description?: string;
  duration?: number;
  durationUnit?: string;
  locationName?: string;
  locationAddress?: string;
  visitType?: string;
  importance?: string;
  isOptional?: boolean;
  additionalFee?: boolean;
  photo?: string;
  type?: string;
}

// ── Pricing helpers ──
interface PriceEntry {
  ageGroup: string;
  retailPrice: number;
  ourPrice?: number;
}

interface PriceSchedule {
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  prices: PriceEntry[];
}

interface PricingOption {
  name: string;
  price: number;
  currency?: string;
}

function extractPricing(schedulesAndPricing: unknown) {
  if (!schedulesAndPricing) return { currency: 'USD', prices: [] as PriceEntry[], schedules: [] as PriceSchedule[], pricingModel: '', maxTravelers: 0 };
  const sp = typeof schedulesAndPricing === 'string'
    ? (() => { try { return JSON.parse(schedulesAndPricing); } catch { return null; } })()
    : schedulesAndPricing as Record<string, unknown>;

  if (!sp) return { currency: 'USD', prices: [] as PriceEntry[], schedules: [] as PriceSchedule[], pricingModel: '', maxTravelers: 0 };

  // Complex format: { pricingSchedules: { currency, schedules: [...] }, travelerDetails: {...} }
  const pricingSchedules = sp.pricingSchedules as { currency?: string; schedules?: PriceSchedule[] } | undefined;
  if (pricingSchedules?.schedules) {
    const currency = pricingSchedules.currency || 'USD';
    const schedules = pricingSchedules.schedules;
    const allPrices = schedules.flatMap((s) => s.prices || []);
    const travelerDetails = sp.travelerDetails as { maxTravelersPerBooking?: number; pricingModel?: string } | undefined;
    return {
      currency,
      prices: allPrices,
      schedules,
      pricingModel: travelerDetails?.pricingModel || 'perPerson',
      maxTravelers: travelerDetails?.maxTravelersPerBooking || 0,
    };
  }

  // Simple format: { options: [{ name, price, currency }] }
  const options = sp.options as PricingOption[] | undefined;
  if (Array.isArray(options)) {
    const currency = options[0]?.currency || 'USD';
    const prices: PriceEntry[] = options.map((o) => ({ ageGroup: o.name, retailPrice: o.price }));
    return { currency, prices, schedules: [], pricingModel: 'perPerson', maxTravelers: 0 };
  }

  return { currency: 'USD', prices: [] as PriceEntry[], schedules: [] as PriceSchedule[], pricingModel: '', maxTravelers: 0 };
}

function extractBookingInfo(bookingAndTickets: unknown) {
  if (!bookingAndTickets) return { confirmationType: '', ticketType: '', cancellation: '' };
  const bt = typeof bookingAndTickets === 'string'
    ? (() => { try { return JSON.parse(bookingAndTickets); } catch { return null; } })()
    : bookingAndTickets as Record<string, unknown>;

  if (!bt) return { confirmationType: '', ticketType: '', cancellation: '' };

  // Complex: { confirmationMode, ticketType, cancellationPolicy: { freeCancellationHours, refundRate } }
  const cp = bt.cancellationPolicy as { freeCancellationHours?: number; refundRate?: number } | string | undefined;
  let cancellation = '';
  if (typeof cp === 'string') {
    cancellation = cp;
  } else if (cp && typeof cp === 'object') {
    const hours = cp.freeCancellationHours || 0;
    const rate = cp.refundRate || 0;
    cancellation = hours > 0 ? `Free cancellation up to ${hours}h before (${rate}% refund)` : 'No free cancellation';
  }

  return {
    confirmationType: (bt.confirmationMode || bt.bookingType || bt.confirmationType || '') as string,
    ticketType: (bt.ticketType || '') as string,
    cancellation,
  };
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl bg-surface-muted p-4">
        <MapPin className="h-8 w-8 text-muted-foreground/30" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Select a tour</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Choose a tour from the list to review its details and take action.
      </p>
    </div>
  );
}

function ItineraryTimeline({ items }: { items: ItineraryStop[] }) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const groupedByDay = items.reduce<Record<number, ItineraryStop[]>>((acc, item) => {
    const day = item.day || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  const days = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No itinerary data</p>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const stops = groupedByDay[day];
        const isExpanded = expandedDays.has(day) || days.length <= 1;

        return (
          <div key={day} className="overflow-hidden rounded-xl border border-border/40">
            <button
              onClick={() => toggleDay(day)}
              className="flex w-full items-center justify-between bg-surface-muted/50 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {day}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Day {day}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stops.length} stop{stops.length !== 1 ? 's' : ''}
                </span>
              </div>
              {days.length > 1 && (
                isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="divide-y divide-border/30">
                {stops.map((stop, i) => {
                  const stopTitle = stop.title || stop.activityName || `Stop ${i + 1}`;
                  const duration = stop.duration
                    ? `${stop.duration} ${stop.durationUnit || 'min'}`
                    : null;

                  return (
                    <div key={i} className="flex gap-4 px-4 py-4">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1">
                        <Circle
                          className={`h-3 w-3 shrink-0 ${
                            stop.importance === 'major'
                              ? 'fill-primary text-primary'
                              : 'fill-muted-foreground/30 text-muted-foreground/30'
                          }`}
                        />
                        {i < stops.length - 1 && (
                          <div className="mt-1 w-px flex-1 bg-border/40" />
                        )}
                      </div>

                      {/* Stop content */}
                      <div className="min-w-0 flex-1 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-foreground">
                                {stopTitle}
                              </h4>
                              {stop.isOptional && (
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                  Optional
                                </Badge>
                              )}
                              {stop.additionalFee && (
                                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                                  Extra fee
                                </Badge>
                              )}
                            </div>
                            {stop.locationName && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {stop.locationName}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {stop.time && (
                              <span className="text-xs font-medium text-muted-foreground">
                                {stop.time}
                              </span>
                            )}
                            {duration && (
                              <span className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {duration}
                              </span>
                            )}
                          </div>
                        </div>

                        {stop.description && (
                          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                            {stop.description}
                          </p>
                        )}

                        {stop.visitType && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Ticket className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">
                              {stop.visitType === 'visit'
                                ? 'Admission included'
                                : stop.visitType === 'pass_by'
                                ? 'Pass by'
                                : stop.visitType}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TourDetailPanel({
  tour,
  draftReview,
  onApprove,
  onFlag,
  isApproving,
  isFlagging,
}: TourDetailPanelProps) {
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  if (!tour) return <EmptyState />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (tour.productContent as Record<string, any>) || {};
  const isPendingEdits =
    tour.status === 'ACTIVE' && tour.draftStatus === 'PENDING_APPROVAL';
  const showDraftReview = isPendingEdits && draftReview;

  const itinerary = Array.isArray(content.itinerary) ? (content.itinerary as ItineraryStop[]) : [];
  const highlights = Array.isArray(content.highlights) ? (content.highlights as string[]) : [];
  const included = content.included
    ? Array.isArray(content.included)
      ? (content.included as string[])
      : [content.included as string]
    : [];
  const excluded = content.excluded
    ? Array.isArray(content.excluded)
      ? (content.excluded as string[])
      : [content.excluded as string]
    : [];

  const pricing = extractPricing(tour.schedulesAndPricing);
  const bookingInfo = extractBookingInfo(tour.bookingAndTickets);
  const tags = Array.isArray(tour.tags) ? (tour.tags as string[]) : [];

  // Categorization blob may hold duration / difficulty / theme
  const categorization = (tour.categorization as Record<string, unknown>) || {};
  const catDuration = categorization.duration as { value?: number; unit?: string } | undefined;
  const resolvedDuration = catDuration
    ? `${catDuration.value} ${catDuration.unit || 'min'}`
    : tour.durationMinutes
    ? `${tour.durationMinutes} min`
    : null;
  const resolvedDifficulty = (categorization.difficulty as string) || tour.difficulty || null;
  const resolvedMaxGroup = pricing.maxTravelers || null;

  const handleFlag = () => {
    if (flagReason.trim().length >= 10) {
      onFlag(flagReason.trim());
      setFlagDialogOpen(false);
      setFlagReason('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 pb-24">
          {/* ── Header ── */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground">{tour.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submitted by {tour.supplier?.name || 'Unknown Provider'}
                </p>
              </div>
              <Badge
                variant={
                  isPendingEdits
                    ? 'info'
                    : tour.status === 'ACTIVE'
                    ? 'success'
                    : tour.status === 'REJECTED'
                    ? 'error'
                    : 'warning'
                }
              >
                {isPendingEdits ? 'Pending Edits' : tour.status || 'Pending Review'}
              </Badge>
            </div>

            {/* Quick facts bar */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/40 py-3">
              {tour.category && (
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {tour.category}
                </div>
              )}
              {resolvedDuration && (
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {resolvedDuration}
                </div>
              )}
              {resolvedMaxGroup && (
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Max {resolvedMaxGroup} people
                </div>
              )}
              {resolvedDifficulty && (
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  {resolvedDifficulty}
                </div>
              )}
              {(tour.city || tour.country) && (
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {[tour.city, tour.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* ── Pending Edits Diff ── */}
            {showDraftReview && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Shield className="h-5 w-5 text-status-approved" />
                  Pending Edits ({draftReview.changesSummary.count} changes)
                </h3>
                <DiffViewer
                  diff={draftReview.diff}
                  changesSummary={draftReview.changesSummary}
                />
              </section>
            )}

            {/* ── Photos ── */}
            {tour.photos && tour.photos.length > 0 && (
              <section>
                <PhotoGallery photos={tour.photos} />
              </section>
            )}

            {/* ── Overview ── */}
            {(tour.description || content.shortSummary) && (
              <section>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Overview
                </h3>
                {tour.description && (
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {tour.description}
                  </p>
                )}
                {content.shortSummary && (
                  <p className="mt-2 text-sm italic text-foreground/60">
                    {content.shortSummary as string}
                  </p>
                )}
              </section>
            )}

            {/* ── Highlights ── */}
            {highlights.length > 0 && (
              <section>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Highlights
                </h3>
                <ul className="space-y-2.5">
                  {highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Itinerary (Viator-style) ── */}
            {itinerary.length > 0 && (
              <section>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Itinerary
                </h3>
                <ItineraryTimeline items={itinerary} />
              </section>
            )}

            {/* ── Included / Not Included ── */}
            {(included.length > 0 || excluded.length > 0) && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {included.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-semibold text-foreground">
                      What's Included
                    </h3>
                    <ul className="space-y-2">
                      {included.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-foreground/80"
                        >
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {excluded.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-semibold text-foreground">
                      Not Included
                    </h3>
                    <ul className="space-y-2">
                      {excluded.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-foreground/80"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {/* ── Meeting Point ── */}
            {(content.meetingInstructions || content.meetingPoint || content.meetingMode) && (
              <section>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Meeting and Pickup
                </h3>
                <div className="space-y-3 rounded-xl border border-border/40 p-4">
                  {content.meetingMode && (
                    <div className="flex items-center gap-2">
                      <Badge variant={content.meetingMode === 'meeting_point' ? 'default' : 'secondary'} className="capitalize">
                        {content.meetingMode === 'meeting_point' ? 'Meet at location' : 'Pickup available'}
                      </Badge>
                    </div>
                  )}
                  {content.meetingInstructions && (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Meeting point</p>
                        <p className="mt-0.5 text-sm text-foreground/70">
                          {content.meetingInstructions as string}
                        </p>
                      </div>
                    </div>
                  )}
                  {content.meetingPoint && typeof content.meetingPoint === 'object' && (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Meeting point</p>
                        <p className="mt-0.5 text-sm text-foreground/70">
                          {(content.meetingPoint as Record<string, string | undefined>).name}
                          {(content.meetingPoint as Record<string, string | undefined>).address && (
                            <span className="block text-xs text-muted-foreground">
                              {(content.meetingPoint as Record<string, string | undefined>).address}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {(content.arrivalTime || content.arrivalTimeCustom) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Arrive {content.arrivalTimeCustom || content.arrivalTime}
                    </div>
                  )}
                  {content.meetingPointPicture && (
                    <div className="mt-2 overflow-hidden rounded-lg">
                      <OptimizedImage
                        src={content.meetingPointPicture as string}
                        alt="Meeting point"
                        className="h-32 w-full object-cover"
                        width={800}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Additional Info ── */}
            {(content.writingLanguage || content.additionalInfo || content.healthRestrictions) && (
              <section>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Additional Info
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.writingLanguage && (
                      <div className="flex gap-4">
                        <dt className="w-32 shrink-0 text-sm font-medium text-muted-foreground">
                          Language
                        </dt>
                        <dd className="text-sm text-foreground">
                          {String(content.writingLanguage)}
                        </dd>
                      </div>
                    )}
                    {content.additionalInfo && (
                      <div className="flex gap-4">
                        <dt className="w-32 shrink-0 text-sm font-medium text-muted-foreground">
                          Know before you go
                        </dt>
                        <dd className="text-sm text-foreground">
                          {content.additionalInfo as string}
                        </dd>
                      </div>
                    )}
                    {content.healthRestrictions && (
                      <div className="flex gap-4">
                        <dt className="w-32 shrink-0 text-sm font-medium text-muted-foreground">
                          Restrictions
                        </dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.healthRestrictions)
                            ? (content.healthRestrictions as string[]).join(', ')
                            : String(content.healthRestrictions)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Food & Dietary ── */}
            {(content.foodProvided || content.meals || content.mealType || content.drinksIncluded || content.dietaryOptions) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Utensils className="h-5 w-5 text-primary" />
                  Food & Dining
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.foodProvided !== undefined && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Food provided</dt>
                        <dd className="text-sm text-foreground">
                          {content.foodProvided ? (
                            <Badge variant="success">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </dd>
                      </div>
                    )}
                    {content.meals && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Meals</dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.meals)
                            ? (content.meals as unknown[]).map((m) => typeof m === 'string' ? m : (m as Record<string, unknown>).type || (m as Record<string, unknown>).name || JSON.stringify(m)).join(', ')
                            : String(content.meals)}
                        </dd>
                      </div>
                    )}
                    {content.mealType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Meal type</dt>
                        <dd className="text-sm capitalize text-foreground">{String(content.mealType)}</dd>
                      </div>
                    )}
                    {content.drinksIncluded !== undefined && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Drinks included</dt>
                        <dd className="text-sm text-foreground">
                          {content.drinksIncluded ? (
                            <Badge variant="success">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </dd>
                      </div>
                    )}
                    {content.dietaryOptions && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Dietary options</dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.dietaryOptions)
                            ? (content.dietaryOptions as string[]).join(', ')
                            : String(content.dietaryOptions)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Transport & Pickup ── */}
            {(content.pickupProvided || content.pickupAvailable || content.pickupType || content.pickupAreas || content.dropoffProvided || content.dropoffAvailable || content.transportationProvided || content.transportationType) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Truck className="h-5 w-5 text-primary" />
                  Transport & Pickup
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {(content.pickupProvided !== undefined || content.pickupAvailable !== undefined) && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pickup</dt>
                        <dd className="text-sm text-foreground">
                          {(content.pickupProvided || content.pickupAvailable) ? (
                            <Badge variant="success">Available</Badge>
                          ) : (
                            <Badge variant="outline">Not available</Badge>
                          )}
                        </dd>
                      </div>
                    )}
                    {content.pickupType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pickup type</dt>
                        <dd className="text-sm capitalize text-foreground">{String(content.pickupType)}</dd>
                      </div>
                    )}
                    {content.pickupAreas && (
                      <div className="flex flex-col gap-1.5">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pickup areas</dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.pickupAreas)
                            ? content.pickupAreas
                                .map((a) => {
                                  if (typeof a === "string") return a
                                  const o = a as { name?: string; address?: string; time?: string; polygon?: unknown; exclusions?: unknown[] }
                                  return [o.name, o.address].filter(Boolean).join(", ") || "—"
                                })
                                .join("; ")
                            : String(content.pickupAreas)}
                        </dd>
                        {Array.isArray(content.pickupAreas) && (
                          <PickupZoneMap
                            areas={content.pickupAreas as { name?: string; address?: string; time?: string; polygon?: [number, number][]; exclusions?: [number, number][][] }[]}
                            height={220}
                          />
                        )}
                      </div>
                    )}
                    {content.pickupDescription && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pickup details</dt>
                        <dd className="text-sm text-foreground">{String(content.pickupDescription)}</dd>
                      </div>
                    )}
                    {content.pickupStartTime && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pickup time</dt>
                        <dd className="text-sm text-foreground">{String(content.pickupStartTime)}</dd>
                      </div>
                    )}
                    {content.transportationProvided !== undefined && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Transport included</dt>
                        <dd className="text-sm text-foreground">
                          {content.transportationProvided ? (
                            <Badge variant="success">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </dd>
                      </div>
                    )}
                    {content.transportationType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Transport type</dt>
                        <dd className="text-sm capitalize text-foreground">{String(content.transportationType)}</dd>
                      </div>
                    )}
                    {(content.dropoffProvided !== undefined || content.dropoffAvailable !== undefined) && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Drop-off</dt>
                        <dd className="text-sm text-foreground">
                          {(content.dropoffProvided || content.dropoffAvailable) ? (
                            <Badge variant="success">Available</Badge>
                          ) : (
                            <Badge variant="outline">Not available</Badge>
                          )}
                        </dd>
                      </div>
                    )}
                    {content.dropoffOption && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Drop-off option</dt>
                        <dd className="text-sm capitalize text-foreground">{String(content.dropoffOption)}</dd>
                      </div>
                    )}
                    {content.dropoffDescription && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Drop-off details</dt>
                        <dd className="text-sm text-foreground">{String(content.dropoffDescription)}</dd>
                      </div>
                    )}
                    {content.crossCityTravel !== undefined && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Cross-city travel</dt>
                        <dd className="text-sm text-foreground">
                          {content.crossCityTravel ? 'Yes' : 'No'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── What to Bring / Restrictions ── */}
            {(content.whatToBring || content.notAllowed || content.petFriendly !== undefined) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Package className="h-5 w-5 text-primary" />
                  What to Bring & Restrictions
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.whatToBring && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">What to bring</dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.whatToBring)
                            ? (content.whatToBring as string[]).join(', ')
                            : String(content.whatToBring)}
                        </dd>
                      </div>
                    )}
                    {content.notAllowed && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Not allowed</dt>
                        <dd className="text-sm text-foreground">
                          {Array.isArray(content.notAllowed)
                            ? (content.notAllowed as string[]).join(', ')
                            : String(content.notAllowed)}
                        </dd>
                      </div>
                    )}
                    {content.petFriendly !== undefined && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Pets</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <PawPrint className="h-4 w-4" />
                          {content.petFriendly ? 'Pet-friendly' : 'No pets allowed'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Requirements ── */}
            {(content.passportRequired || content.flightInfoRequired || content.shipInfoRequired || content.trainInfoRequired || content.hotelInfoRequired) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Requirements
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.passportRequired && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Passport</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <Shield className="h-4 w-4 text-primary" />
                          Required
                        </dd>
                      </div>
                    )}
                    {content.flightInfoRequired && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Flight info</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <Plane className="h-4 w-4 text-primary" />
                          Required
                        </dd>
                      </div>
                    )}
                    {content.shipInfoRequired && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Ship info</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <Ship className="h-4 w-4 text-primary" />
                          Required
                        </dd>
                      </div>
                    )}
                    {content.trainInfoRequired && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Train info</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <Train className="h-4 w-4 text-primary" />
                          Required
                        </dd>
                      </div>
                    )}
                    {content.hotelInfoRequired && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Hotel info</dt>
                        <dd className="flex items-center gap-1.5 text-sm text-foreground">
                          <Hotel className="h-4 w-4 text-primary" />
                          Required
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Guide Info ── */}
            {(content.guideType || content.guideMaterials) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Guide Information
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.guideType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Guide type</dt>
                        <dd className="text-sm capitalize text-foreground">{String(content.guideType)}</dd>
                      </div>
                    )}
                    {content.guideMaterials && typeof content.guideMaterials === 'object' && (
                      <>
                        {(content.guideMaterials as Record<string, unknown>).audioGuide !== undefined && (
                          <div className="flex gap-4">
                            <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Audio guide</dt>
                            <dd className="text-sm text-foreground">
                              {(content.guideMaterials as Record<string, unknown>).audioGuide ? 'Available' : 'Not available'}
                            </dd>
                          </div>
                        )}
                        {(content.guideMaterials as Record<string, unknown>).infoBooklet !== undefined && (
                          <div className="flex gap-4">
                            <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Info booklet</dt>
                            <dd className="text-sm text-foreground">
                              {(content.guideMaterials as Record<string, unknown>).infoBooklet ? 'Available' : 'Not available'}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Contact & Emergency ── */}
            {(content.emergencyPhone || content.contactPhone || content.voucherInfo) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Phone className="h-5 w-5 text-primary" />
                  Contact & Voucher Info
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {content.emergencyPhone && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Emergency phone</dt>
                        <dd className="text-sm text-foreground">
                          {content.emergencyCountryCode && <span className="mr-1 text-muted-foreground">+{String(content.emergencyCountryCode)}</span>}
                          {String(content.emergencyPhone)}
                        </dd>
                      </div>
                    )}
                    {content.contactPhone && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Contact phone</dt>
                        <dd className="text-sm text-foreground">{String(content.contactPhone)}</dd>
                      </div>
                    )}
                    {content.voucherInfo && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">Voucher info</dt>
                        <dd className="text-sm text-foreground">{String(content.voucherInfo)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Tour Stats ── */}
            {(tour.averageRating || tour.reviewCount || tour.totalBookings || tour.viewCount) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Performance Stats
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {tour.averageRating && (
                    <div className="flex flex-col items-center rounded-xl border border-border/40 p-3">
                      <Star className="h-5 w-5 text-warning" />
                      <span className="mt-1 text-lg font-bold text-foreground">{tour.averageRating as number}</span>
                      <span className="text-[11px] text-muted-foreground">Rating</span>
                    </div>
                  )}
                  {tour.reviewCount !== undefined && (
                    <div className="flex flex-col items-center rounded-xl border border-border/40 p-3">
                      <Tag className="h-5 w-5 text-primary" />
                      <span className="mt-1 text-lg font-bold text-foreground">{tour.reviewCount as number}</span>
                      <span className="text-[11px] text-muted-foreground">Reviews</span>
                    </div>
                  )}
                  {tour.totalBookings !== undefined && (
                    <div className="flex flex-col items-center rounded-xl border border-border/40 p-3">
                      <Ticket className="h-5 w-5 text-primary" />
                      <span className="mt-1 text-lg font-bold text-foreground">{tour.totalBookings as number}</span>
                      <span className="text-[11px] text-muted-foreground">Bookings</span>
                    </div>
                  )}
                  {tour.viewCount !== undefined && (
                    <div className="flex flex-col items-center rounded-xl border border-border/40 p-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="mt-1 text-lg font-bold text-foreground">{tour.viewCount as number}</span>
                      <span className="text-[11px] text-muted-foreground">Views</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Pricing & Availability ── */}
            {(pricing.prices.length > 0 || pricing.schedules.length > 0) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Pricing & Availability
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  {/* Price table */}
                  {pricing.prices.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Price per person
                        </span>
                        {pricing.pricingModel && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {pricing.pricingModel}
                          </Badge>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 bg-surface-muted/50">
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                Age Group
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                                Retail
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                                Our Price
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pricing.prices.map((p, i) => (
                              <tr key={i} className="border-b border-border/20 last:border-0">
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {p.ageGroup}
                                </td>
                                <td className="px-3 py-2 text-right text-foreground/70">
                                  {pricing.currency} {p.retailPrice}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-primary">
                                  {pricing.currency} {p.ourPrice ?? p.retailPrice}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Schedule */}
                  {pricing.schedules.length > 0 && (
                    <div>
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Available dates
                      </span>
                      <div className="space-y-2">
                        {pricing.schedules.map((sch, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg bg-surface-muted/50 px-3 py-2"
                          >
                            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1 text-sm">
                              <span className="font-medium text-foreground">
                                {sch.startDate}
                              </span>
                              <span className="mx-1.5 text-muted-foreground">to</span>
                              <span className="font-medium text-foreground">
                                {sch.endDate}
                              </span>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, di) => (
                                <span
                                  key={di}
                                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${
                                    sch.daysOfWeek?.includes(di)
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-surface-muted text-muted-foreground/40'
                                  }`}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pricing.maxTravelers > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Max {pricing.maxTravelers} travelers per booking
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Booking Info ── */}
            {(bookingInfo.confirmationType || bookingInfo.ticketType || bookingInfo.cancellation) && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Booking Information
                </h3>
                <div className="rounded-xl border border-border/40 p-4">
                  <dl className="space-y-3">
                    {bookingInfo.confirmationType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">
                          Confirmation
                        </dt>
                        <dd className="text-sm text-foreground">
                          <Badge
                            variant={bookingInfo.confirmationType === 'instant' ? 'success' : 'warning'}
                            className="capitalize"
                          >
                            {bookingInfo.confirmationType}
                          </Badge>
                        </dd>
                      </div>
                    )}
                    {bookingInfo.ticketType && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">
                          Ticket type
                        </dt>
                        <dd className="text-sm capitalize text-foreground">
                          {bookingInfo.ticketType}
                        </dd>
                      </div>
                    )}
                    {bookingInfo.cancellation && (
                      <div className="flex gap-4">
                        <dt className="w-36 shrink-0 text-sm font-medium text-muted-foreground">
                          Cancellation
                        </dt>
                        <dd className="text-sm text-foreground">
                          {bookingInfo.cancellation}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}

            {/* ── Tags ── */}
            {tags.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Tag className="h-5 w-5 text-primary" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>

      {/* ── Sticky Action Bar (only for pending reviews) ── */}
      {(tour.status === 'PENDING_APPROVAL' || tour.draftStatus === 'PENDING_APPROVAL') && (
        <div className="shrink-0 border-t border-border/40 bg-surface-base/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 p-4">
            <Button
              onClick={onApprove}
              disabled={isApproving || isFlagging}
              className="flex-1 gap-2 rounded-xl"
            >
              <CheckCircle className="h-4 w-4" />
              {isApproving
                ? 'Approving...'
                : tour.status === 'ACTIVE' && tour.draftStatus === 'PENDING_APPROVAL'
                  ? 'Approve Edit'
                  : 'Approve & Make Live'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setFlagDialogOpen(true)}
              disabled={isApproving || isFlagging}
              className="gap-2 rounded-xl text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Flag className="h-4 w-4" />
              Flag
            </Button>
          </div>
        </div>
      )}

      {/* ── Flag Dialog ── */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Flag Tour for Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for flagging this tour. The provider will be
              notified.
            </p>
            <Textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Describe the issue (minimum 10 characters)..."
              className="min-h-[120px] rounded-xl"
            />
            {flagReason.length > 0 && flagReason.length < 10 && (
              <p className="text-xs text-destructive">
                {10 - flagReason.length} more characters required
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setFlagDialogOpen(false);
                setFlagReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleFlag}
              disabled={flagReason.trim().length < 10 || isFlagging}
            >
              {isFlagging ? 'Flagging...' : 'Submit Flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
