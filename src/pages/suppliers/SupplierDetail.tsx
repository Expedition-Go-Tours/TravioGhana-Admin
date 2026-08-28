import { useState, type ReactNode } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Trash2,
  Building2,
  Globe,
  Phone,
  Mail,
  Calendar,
  Shield,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Wallet,
  CreditCard,
  Check,
  AlertCircle,
  BarChart3,
  List,
  DollarSign,
  Star,
  BookOpen,
  MapPin,
  TrendingUp,
  HandCoins,
  Users,
  ArrowUpRight,
  Quote,
} from "lucide-react";
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { SafeImage } from "@/components/shared/SafeImage";
import { StatCard } from "@/components/shared/StatCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { chartColors, chartAxis } from "@/components/shared/chartTheme";
import SupplierVerificationPanel from "@/pages/suppliers/SupplierVerificationPanel";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/usePermission";
import api from "@/lib/axios";
import { cn, formatDate, formatCurrency, formatNumber } from "@/lib/utils";

interface BusinessInfo {
  legalBusinessName?: string;
  businessName?: string;
  displayName?: string;
  businessType?: string;
  country?: string;
  city?: string;
  state?: string;
  address?: string | { line1?: string; city?: string; state?: string; postalCode?: string };
  phoneNumber?: string;
  phone?: string;
  website?: string;
}

interface OperatingInfo {
  tourCategories?: string[];
  destinations?: string[];
  languages?: string[];
  cancellationPolicy?: string;
  meetingStyle?: string;
  yearsInBusiness?: string | number;
  regions?: string[];
  serviceArea?: string;
}

interface RepresentativeInfo {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  dateOfBirth?: string;
  dob?: string;
  birthDate?: string;
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  address?: string | { line1?: string; city?: string; state?: string; postalCode?: string };
}

interface BusinessDocuments {
  registrationDocumentUrl?: string;
  taxDocumentUrl?: string;
  proofOfAddressUrl?: string;
  certificateOfRegistration?: string;
  taxCertificate?: string;
  proofOfAddress?: string;
  licenses?: string[];
}

interface PayoutInfo {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankCountry?: string;
  bankCode?: string;
  payoutCurrency?: string;
  currency?: string;
  method?: string;
  accountName?: string;
  accountNumber?: string;
}

interface Compliance {
  acceptedTerms?: boolean;
  agreedToPayoutTerms?: boolean;
  verified?: boolean;
  reviewStatus?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  codeOfConductAccepted?: boolean;
  dataProcessingAccepted?: boolean;
  marketingConsent?: boolean;
}

interface SupplierProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  businessInfo?: BusinessInfo;
  operatingInfo?: OperatingInfo;
  representativeInfo?: RepresentativeInfo;
  businessDocuments?: BusinessDocuments;
  documents?: {
    registrationDocument?: string;
    taxDocument?: string;
    proofOfAddress?: string;
    idDocument?: string;
    licenses?: string[];
  };
  payoutInfo?: PayoutInfo;
  compliance?: Compliance;
  adminNotes?: string | null;
  archivedAt?: string | null;
}

interface SupplierStats {
  earnings: number;
  totalBookings: number;
  totalCommission: number;
  averageRating: number;
  totalReviews: number;
  tours: { total: number; active: number; draft: number; paused: number; archived: number };
  bookings: { total: number; pending: number; confirmed: number; completed: number; cancelled: number };
  tourCommissions: TourCommission[];
}

interface TourCommission {
  id: string;
  title: string;
  coverPhoto?: string;
  status: string;
  bookings: number;
  commission: number;
  revenue: number;
}

interface SupplierTour {
  id: string;
  title: string;
  coverPhoto?: string;
  slug: string;
  status: string;
  totalBookings: number;
  averageRating?: number;
  reviewCount: number;
  city?: string;
  country?: string;
  createdAt: string;
}

interface SupplierToursResponse {
  tours: SupplierTour[];
  pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; limit: number };
}

interface ReviewItem {
  id: string;
  rating: number;
  title?: string;
  comment?: string;
  travelMonth?: string;
  createdAt: string;
  verified: boolean;
  supplierResponse?: string | null;
  customer?: { id?: string; name?: string; photoURL?: string };
  tour?: { id?: string; title?: string; coverPhoto?: string };
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
  pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; limit: number };
}

interface AnalyticsPoint {
  month: string;
  bookings: number;
  gross: number;
  commission: number;
}

interface AnalyticsResponse {
  months: number;
  series: AnalyticsPoint[];
}

type ActionType = "approve" | "reject" | "request_info" | "activate" | "suspend" | "reactivate" | "delete";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [modalAction, setModalAction] = useState<ActionType | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "supplier", id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/admin/${id}/profile`);
      const body = res.data?.data as { supplier?: SupplierProfile; stats?: SupplierStats };
      if (!body?.supplier) throw new Error("Supplier not found");
      return body;
    },
    enabled: !!id,
  });

  const supplier: SupplierProfile | undefined = data?.supplier;
  const stats = data?.stats;
  const status = supplier?.status || "";
  const userId = supplier?.userId || id || "";
  const profileId = supplier?.id || id || "";

  const { data: payoutData, isLoading: payoutLoading } = useQuery({
    queryKey: ["admin", "payout-methods", "supplier", userId],
    queryFn: () => api.get(`/payout-methods/admin/suppliers/${userId}`).then((r) => r.data?.data),
    enabled: !!userId && can("payout-methods.view"),
  });

  const payoutMethods = (payoutData?.methods || []) as PayoutMethodItem[];

  const { data: toursData, isLoading: toursLoading } = useQuery({
    queryKey: ["admin", "supplier", profileId, "tours"],
    queryFn: () => api.get(`/suppliers/admin/${profileId}/tours?limit=50`).then((r) => r.data?.data as SupplierToursResponse),
    enabled: !!profileId,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["admin", "supplier", profileId, "reviews"],
    queryFn: () => api.get(`/suppliers/admin/${profileId}/reviews?limit=50`).then((r) => r.data?.data as ReviewsResponse),
    enabled: !!profileId && can("reviews.view"),
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin", "supplier", profileId, "analytics"],
    queryFn: () => api.get(`/suppliers/admin/${profileId}/analytics?months=12`).then((r) => r.data?.data as AnalyticsResponse),
    enabled: !!profileId,
  });

  const reviewMutation = useMutation({
    mutationFn: (body: { action: string; notes?: string }) =>
      api.patch(`/suppliers/admin/applications/${id}/review`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast.success("Action completed successfully");
      setModalAction(null);
      setReason("");
    },
    onError: () => toast.error("Failed to perform action"),
  });

  const toggleMutation = useMutation({
    mutationFn: (body: { suspend: boolean; reason?: string }) =>
      api.patch(`/suppliers/admin/${id}/suspend`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast.success("Status updated");
      setModalAction(null);
      setReason("");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const activateMutation = useMutation({
    mutationFn: () => api.patch(`/suppliers/admin/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast.success("Supplier activated!");
      setModalAction(null);
    },
    onError: () => toast.error("Failed to activate supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`),
    onSuccess: () => {
      toast.success("User deleted");
      navigate("/admin/suppliers");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const handleAction = () => {
    if (!modalAction) return;
    if (modalAction === "activate") {
      activateMutation.mutate();
    } else if (modalAction === "suspend") {
      toggleMutation.mutate({ suspend: true, reason });
    } else if (modalAction === "reactivate") {
      toggleMutation.mutate({ suspend: false, reason });
    } else if (["approve", "reject", "request_info"].includes(modalAction)) {
      const body: { action: string; notes?: string } = { action: modalAction };
      if (reason) body.notes = reason;
      reviewMutation.mutate(body);
    }
  };

  const handleOpenTour = (tourId: string) => navigate(`/admin/tours/${tourId}`);

  const getActionButtons = () => {
    const s = status;
    if (["PENDING", "UNDER_REVIEW"].includes(s)) {
      return [
        ...(can('suppliers.approve') ? [{ label: "Approve", action: "approve" as ActionType, icon: <CheckCircle className="h-3.5 w-3.5" />, variant: "default" as const }] : []),
        ...(can('suppliers.approve') ? [{ label: "Reject", action: "reject" as ActionType, icon: <XCircle className="h-3.5 w-3.5" />, variant: "destructive" as const }] : []),
        ...(can('suppliers.approve') ? [{ label: "Request Info", action: "request_info" as ActionType, icon: <AlertTriangle className="h-3.5 w-3.5" />, variant: "outline" as const }] : []),
      ];
    }
    if (s === "APPROVED" && can('suppliers.approve')) return [{ label: "Activate", action: "activate" as ActionType, icon: <CheckCircle className="h-3.5 w-3.5" />, variant: "default" as const }];
    if (s === "ACTIVE" && can('suppliers.suspend')) return [{ label: "Suspend", action: "suspend" as ActionType, icon: <AlertTriangle className="h-3.5 w-3.5" />, variant: "destructive" as const }];
    if (s === "SUSPENDED" && can('suppliers.suspend')) return [{ label: "Reactivate", action: "reactivate" as ActionType, icon: <CheckCircle className="h-3.5 w-3.5" />, variant: "default" as const }];
    return [];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) return <SectionError message="Failed to load supplier" onRetry={() => refetch()} />;
  if (!supplier) return <SectionError message="Supplier not found" />;

  const actions = getActionButtons();

  const legalName =
    supplier.businessInfo?.legalBusinessName ||
    supplier.businessInfo?.businessName ||
    supplier.businessInfo?.displayName;

  return (
    <div className="space-y-6">
      <SupplierBreadcrumb title={supplier.name} onBack={() => navigate(-1)} onAll={() => navigate("/admin/suppliers")} />

      <SupplierHero supplier={supplier} stats={stats} actions={actions} onAction={(a) => { setModalAction(a); setReason(""); }} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Earnings"
          value={stats ? formatCurrency(stats.earnings) : "—"}
          icon={<DollarSign className="h-5 w-5" />}
          accent="emerald"
          loading={!stats}
          subtitle="Lifetime supplier earnings"
        />
        <StatCard
          label="Total Bookings"
          value={stats ? formatNumber(stats.totalBookings) : "—"}
          icon={<BookOpen className="h-5 w-5" />}
          accent="blue"
          loading={!stats}
          subtitle={stats ? `${formatNumber(stats.bookings.completed)} completed` : undefined}
        />
        <StatCard
          label="Commission Earned"
          value={stats ? formatCurrency(stats.totalCommission) : "—"}
          icon={<HandCoins className="h-5 w-5" />}
          accent="amber"
          loading={!stats}
          subtitle="Platform commission"
        />
        <StatCard
          label="Average Rating"
          value={stats ? Number(stats.averageRating).toFixed(1) : "—"}
          icon={<Star className="h-5 w-5" />}
          accent="emerald"
          loading={!stats}
          subtitle={stats ? `${formatNumber(stats.totalReviews)} reviews` : undefined}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="business"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Business</TabsTrigger>
          <TabsTrigger value="operating"><Globe className="mr-1.5 h-3.5 w-3.5" /> Operating</TabsTrigger>
          <TabsTrigger value="representative"><Shield className="mr-1.5 h-3.5 w-3.5" /> Rep</TabsTrigger>
          <TabsTrigger value="documents"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verification</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="tours"><List className="mr-1.5 h-3.5 w-3.5" /> Tours <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">{toursData?.pagination?.totalCount ?? "…"}</span></TabsTrigger>
          <TabsTrigger value="reviews"><Star className="mr-1.5 h-3.5 w-3.5" /> Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-5">
            <AnalyticsCard data={analyticsData?.series} loading={analyticsLoading} />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <BreakdownCard
                title="Tours by Status"
                items={[
                  { label: "Active", value: stats?.tours.active ?? 0, color: chartColors.green },
                  { label: "Draft", value: stats?.tours.draft ?? 0, color: chartColors.blue },
                  { label: "Paused", value: stats?.tours.paused ?? 0, color: chartColors.amber },
                  { label: "Archived", value: stats?.tours.archived ?? 0, color: "hsl(var(--text-tertiary))" },
                ]}
                total={stats?.tours.total ?? 0}
                loading={!stats}
              />
              <BreakdownCard
                title="Bookings by Status"
                items={[
                  { label: "Confirmed", value: stats?.bookings.confirmed ?? 0, color: chartColors.green },
                  { label: "Pending", value: stats?.bookings.pending ?? 0, color: chartColors.amber },
                  { label: "Completed", value: stats?.bookings.completed ?? 0, color: chartColors.blue },
                  { label: "Cancelled", value: stats?.bookings.cancelled ?? 0, color: chartColors.red },
                ]}
                total={stats?.bookings.total ?? 0}
                loading={!stats}
              />
            </div>

            {(stats?.tourCommissions?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <HandCoins className="h-4 w-4 text-primary" /> Commission per Tour
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface-muted/40">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tour</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Bookings</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Revenue</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats?.tourCommissions || []).map((tc) => (
                          <tr
                            key={tc.id}
                            className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-muted/30"
                            onClick={() => navigate(`/admin/tours/${tc.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                                  {tc.coverPhoto ? (
                                    <SafeImage src={tc.coverPhoto} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">
                                      <Building2 className="h-3.5 w-3.5" />
                                    </div>
                                  )}
                                </div>
                                <span className="max-w-[240px] truncate font-medium text-text-primary">{tc.title}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={tc.status} /></td>
                            <td className="px-4 py-3 text-center text-text-primary">{formatNumber(tc.bookings)}</td>
                            <td className="px-4 py-3 text-right text-text-primary">{formatCurrency(tc.revenue)}</td>
                            <td className="px-4 py-3 text-right font-medium text-status-active">{formatCurrency(tc.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardHeader className="border-b border-border pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Building2 className="h-4 w-4 text-primary" /> Business Information</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DetailTable
                rows={[
                  { label: "Legal Business Name", value: legalName },
                  { label: "Display Name", value: supplier.businessInfo?.displayName || supplier.businessInfo?.businessName },
                  { label: "Business Type", value: supplier.businessInfo?.businessType },
                  { label: "Phone", value: supplier.businessInfo?.phoneNumber || supplier.businessInfo?.phone },
                  { label: "Country", value: supplier.businessInfo?.country },
                  { label: "City", value: supplier.businessInfo?.city || (typeof supplier.businessInfo?.address === "object" ? supplier.businessInfo?.address?.city : undefined) },
                  { label: "State", value: supplier.businessInfo?.state || (typeof supplier.businessInfo?.address === "object" ? supplier.businessInfo?.address?.state : undefined) },
                  { label: "Address", value: typeof supplier.businessInfo?.address === "string" ? supplier.businessInfo.address : supplier.businessInfo?.address?.line1 },
                  { label: "Website", value: supplier.businessInfo?.website },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operating">
          <Card>
            <CardHeader className="border-b border-border pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Globe className="h-4 w-4 text-primary" /> Operating Information</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DetailTable
                rows={[
                  { label: "Tour Categories", value: supplier.operatingInfo?.tourCategories?.length ? supplier.operatingInfo.tourCategories.join(", ") : null },
                  { label: "Destinations", value: supplier.operatingInfo?.destinations?.length ? supplier.operatingInfo.destinations.join(", ") : null },
                  { label: "Languages", value: supplier.operatingInfo?.languages?.length ? supplier.operatingInfo.languages.join(", ") : null },
                  { label: "Regions", value: supplier.operatingInfo?.regions?.length ? supplier.operatingInfo.regions.join(", ") : null },
                  { label: "Service Area", value: supplier.operatingInfo?.serviceArea },
                  { label: "Cancellation Policy", value: supplier.operatingInfo?.cancellationPolicy },
                  { label: "Meeting Style", value: supplier.operatingInfo?.meetingStyle },
                  { label: "Years in Business", value: supplier.operatingInfo?.yearsInBusiness != null ? String(supplier.operatingInfo.yearsInBusiness) : null },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="representative">
          <Card>
            <CardHeader className="border-b border-border pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Shield className="h-4 w-4 text-primary" /> Representative Information</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DetailTable
                rows={[
                  { label: "Full Name", value: supplier.representativeInfo?.fullName },
                  { label: "Email", value: supplier.representativeInfo?.email },
                  { label: "Phone", value: supplier.representativeInfo?.phoneNumber || supplier.representativeInfo?.phone },
                  { label: "Date of Birth", value: supplier.representativeInfo?.dateOfBirth || supplier.representativeInfo?.dob || supplier.representativeInfo?.birthDate },
                  { label: "ID Type", value: supplier.representativeInfo?.idType },
                  { label: "Address", value: typeof supplier.representativeInfo?.address === "string" ? supplier.representativeInfo.address : supplier.representativeInfo?.address?.line1 },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <SupplierVerificationPanel supplierId={profileId} />
        </TabsContent>


        <TabsContent value="payout">
          <div className="space-y-4">
            {payoutLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-32 w-full rounded-lg" /></CardContent></Card>
            ) : payoutMethods.length > 0 ? (
              payoutMethods.map((method) => (
                <PayoutMethodCard key={method.id} method={method} />
              ))
            ) : (
              <Card>
                <CardHeader className="border-b border-border pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Wallet className="h-4 w-4 text-primary" /> Payout Information</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <DetailTable
                    rows={[
                      { label: "Bank Account Name", value: supplier.payoutInfo?.bankAccountName || supplier.payoutInfo?.accountName },
                      { label: "Account Number", value: supplier.payoutInfo?.bankAccountNumber },
                      { label: "Bank Name", value: supplier.payoutInfo?.bankName },
                      { label: "Bank Code", value: supplier.payoutInfo?.bankCode },
                      { label: "Bank Country", value: supplier.payoutInfo?.bankCountry },
                      { label: "Payout Currency", value: supplier.payoutInfo?.payoutCurrency || supplier.payoutInfo?.currency },
                    ]}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader className="border-b border-border pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Shield className="h-4 w-4 text-primary" /> Compliance Checklist</CardTitle></CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {[
                  { label: "Accepted Terms", value: supplier.compliance?.acceptedTerms ?? supplier.compliance?.termsAccepted },
                  { label: "Privacy Accepted", value: supplier.compliance?.privacyAccepted },
                  { label: "Agreed to Payout Terms", value: supplier.compliance?.agreedToPayoutTerms },
                  { label: "Verified", value: supplier.compliance?.verified },
                  { label: "Code of Conduct", value: supplier.compliance?.codeOfConductAccepted },
                  { label: "Data Processing", value: supplier.compliance?.dataProcessingAccepted },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-surface-base px-4 py-3">
                    <span className="text-sm text-text-primary">{item.label}</span>
                    {item.value ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-active">
                        <CheckCircle className="h-4 w-4" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-rejected">
                        <XCircle className="h-4 w-4" />
                        No
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tours">
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <List className="h-4 w-4 text-primary" /> Tours
                <span className="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {toursData?.pagination?.totalCount ?? "…"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {toursLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-36 w-full rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !toursData?.tours?.length ? (
                <SectionEmpty message="No tours yet" />
              ) : (
                <TourCardGrid tours={toursData.tours} onOpen={handleOpenTour} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          {!can("reviews.view") ? (
            <Card><CardContent className="p-6"><SectionEmpty message="You don't have permission to view reviews" /></CardContent></Card>
          ) : reviewsLoading ? (
            <Card><CardContent className="p-6"><Skeleton className="h-64 w-full rounded-xl" /></CardContent></Card>
          ) : !reviewsData?.reviews?.length ? (
            <Card><CardContent className="p-6"><SectionEmpty message="No reviews yet for this supplier" /></CardContent></Card>
          ) : (
            <ReviewsTab data={reviewsData} />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete User — subtle, at bottom */}
      {can('suppliers.suspend') && (
        <div className="flex items-center justify-between rounded-lg border border-border-muted bg-surface-base px-5 py-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Danger Zone</p>
            <p className="text-xs text-text-tertiary">Permanently delete this user and all associated data</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setModalAction("delete" as ActionType)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete User
          </Button>
        </div>
      )}

      {/* Action Modal */}
      {modalAction && modalAction !== "delete" && (
        <ConfirmModal
          open={!!modalAction}
          title={actionModals[modalAction]?.title || "Confirm"}
          description={actionModals[modalAction]?.description || "Are you sure?"}
          confirmLabel={actionModals[modalAction]?.confirmLabel || "Confirm"}
          confirmVariant={actionModals[modalAction]?.confirmVariant}
          loading={reviewMutation.isPending || toggleMutation.isPending || activateMutation.isPending}
          onConfirm={handleAction}
          onCancel={() => { setModalAction(null); setReason(""); }}
        >
          {modalAction && actionModals[modalAction]?.hasReason && (
            <div className="space-y-2 py-2">
              <Label htmlFor="reason">
                Notes {actionModals[modalAction]?.reasonRequired ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={actionModals[modalAction]?.reasonRequired ? "Enter reason (min 10 characters)..." : "Enter notes..."}
                rows={3}
              />
              {actionModals[modalAction]?.reasonRequired && reason.length > 0 && reason.length < (actionModals[modalAction]?.reasonMin || 10) && (
                <p className="text-xs text-status-rejected">Minimum {actionModals[modalAction]?.reasonMin} characters</p>
              )}
            </div>
          )}
        </ConfirmModal>
      )}

      {/* Delete Modal */}
      {modalAction === "delete" && (
        <ConfirmModal
          open={true}
          title="Delete User?"
          description={`This will permanently delete ${supplier.name || "this user"}'s account. This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="destructive"
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setModalAction(null)}
        >
          <div className="rounded-lg bg-surface-muted p-3 text-sm space-y-1">
            <p><span className="text-text-secondary">Name:</span> {supplier.name || "—"}</p>
            <p><span className="text-text-secondary">Email:</span> {supplier.email || "—"}</p>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function SupplierBreadcrumb({ title, onBack, onAll }: { title: string; onBack: () => void; onAll: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-text-tertiary">
      <button onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-base text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4 text-text-primary" />
      </button>
      <button onClick={onAll} className="transition-colors hover:text-text-primary">Suppliers</button>
      <ChevronRight className="h-3 w-3" />
      <span className="truncate font-medium text-text-primary">{title}</span>
    </div>
  );
}

interface HeroAction {
  label: string;
  action: ActionType;
  icon: ReactNode;
  variant: "default" | "destructive" | "outline";
}

function SupplierHero({
  supplier,
  stats,
  actions,
  onAction,
}: {
  supplier: SupplierProfile;
  stats?: SupplierStats;
  actions: HeroAction[];
  onAction: (action: ActionType) => void;
}) {
  const locationLabel = [supplier.businessInfo?.city, supplier.businessInfo?.country].filter(Boolean).join(", ");
  const website = supplier.businessInfo?.website;
  const complianceVerified = supplier.compliance?.verified;

  const quickStats = [
    { label: "Rating", value: stats ? Number(stats.averageRating).toFixed(1) : "—", emphasize: true, icon: <Star className="h-3.5 w-3.5 fill-current" /> },
    { label: "Reviews", value: stats ? formatNumber(stats.totalReviews) : "—" },
    { label: "Active Tours", value: stats ? formatNumber(stats.tours.active) : "—" },
    { label: "Bookings", value: stats ? formatNumber(stats.totalBookings) : "—" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-base shadow-soft">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/30" />
      <div className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xl font-bold text-primary ring-1 ring-primary/20">
              {supplier.photoURL ? (
                <SafeImage src={supplier.photoURL} alt={supplier.name || ""} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span>{supplier.name?.charAt(0)?.toUpperCase() || "?"}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-text-primary">{supplier.name || "Unknown"}</h1>
                <StatusBadge status={supplier.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-secondary">
                {!!supplier.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-text-tertiary" />
                    {supplier.email}
                  </span>
                )}
                {!!supplier.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                    {supplier.phone}
                  </span>
                )}
                {!!locationLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                    {locationLabel}
                  </span>
                )}
                {!!supplier.createdAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                    Member since {formatDate(supplier.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-7 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {quickStats.map((s) => (
              <div key={s.label} className="min-w-[64px] text-center">
                <div className={cn("flex items-center justify-center gap-1 text-xl font-bold tabular-nums tracking-tight", s.emphasize ? "text-primary" : "text-text-primary")}>
                  {s.icon}
                  {s.value}
                </div>
                <p className="mt-0.5 text-center text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-tertiary">
            {complianceVerified && (
              <span className="inline-flex items-center gap-1 font-medium text-status-active">
                <CheckCircle className="h-3.5 w-3.5" /> Verified business
              </span>
            )}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-text-secondary transition-colors hover:text-primary">
                <Globe className="h-3.5 w-3.5" /> {website.replace(/^https?:\/\//, "")}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {!website && !complianceVerified && <span>—</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((btn) => (
              <Button
                key={btn.action}
                variant={btn.variant}
                size="sm"
                onClick={() => onAction(btn.action)}
                className="gap-1.5"
              >
                {btn.icon}
                {btn.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ data, loading }: { data?: AnalyticsPoint[]; loading?: boolean }) {
  const chartData = data || [];
  return (
    <Card>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <TrendingUp className="h-4 w-4 text-primary" /> Monthly Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : chartData.length === 0 ? (
          <SectionEmpty message="No performance data yet" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="supplierGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.green} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="supplierCommission" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.blue} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartAxis.grid} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: chartAxis.tick }}
                  tickFormatter={(m: string) => {
                    const d = new Date(`${m}-01T00:00:00`);
                    return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-US", { month: "short" });
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: chartAxis.tick }}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${Math.round(v)}`)}
                  width={54}
                />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />}
                  cursor={{ stroke: chartAxis.reference }}
                />
                <Area type="monotone" dataKey="gross" stroke={chartColors.green} strokeWidth={2.5} fillOpacity={1} fill="url(#supplierGross)" name="Gross Revenue" />
                <Area type="monotone" dataKey="commission" stroke={chartColors.blue} strokeWidth={2.5} fillOpacity={1} fill="url(#supplierCommission)" name="Commission" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-6">
              <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.green }} />
                Gross Revenue
              </span>
              <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.blue }} />
                Commission
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  items,
  total,
  loading,
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="text-sm font-semibold text-text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : (
          <div className="space-y-3.5">
            {items.map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className="font-semibold text-text-primary tabular-nums">{formatNumber(item.value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TourCardGrid({ tours, onOpen }: { tours: SupplierTour[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tours.map((tour) => {
        const location = [tour.city, tour.country].filter(Boolean).join(", ");
        return (
          <div
            key={tour.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(tour.id)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(tour.id); }}
            className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="relative h-36 w-full overflow-hidden bg-surface-muted">
              {tour.coverPhoto ? (
                <SafeImage src={tour.coverPhoto} alt={tour.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                  <Building2 className="h-10 w-10 text-primary/40" />
                </div>
              )}
              <div className="absolute right-2.5 top-2.5">
                <StatusBadge status={tour.status} className="border-border bg-surface-base/90 backdrop-blur-sm" />
              </div>
            </div>
            <div className="space-y-2.5 p-4">
              <p className="truncate text-sm font-semibold text-text-primary">{tour.title}</p>
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span className="truncate">{location || "Unknown"}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {tour.averageRating != null ? Number(tour.averageRating).toFixed(1) : "—"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-text-tertiary" />
                  {formatNumber(tour.totalBookings)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReviewsTab({ data }: { data: ReviewsResponse }) {
  const total = data.totalReviews;
  const rows = [5, 4, 3, 2, 1];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Star className="h-4 w-4 text-amber-500" /> Rating Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold tracking-tight text-text-primary tabular-nums">{Number(data.averageRating).toFixed(1)}</span>
            <div className="pb-1.5">
              <StarRow rating={Math.round(data.averageRating)} />
              <p className="mt-1 text-xs text-text-tertiary">{formatNumber(total)} reviews</p>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {rows.map((star) => {
              const count = data.distribution?.[String(star)] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2.5">
                  <span className="w-8 shrink-0 text-xs font-medium text-text-secondary">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-text-tertiary">{formatNumber(count)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Users className="h-4 w-4 text-primary" /> Recent Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {data.reviews.map((review) => (
            <article key={review.id} className="py-5 first:pt-4 last:pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {review.customer?.photoURL ? (
                      <SafeImage src={review.customer.photoURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{review.customer?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">{review.customer?.name || "Customer"}</p>
                      <StarRow rating={review.rating} size="sm" />
                      {review.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-active/10 px-2 py-0.5 text-[10px] font-semibold text-status-active">
                          <CheckCircle className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {formatDate(review.createdAt)}
                      {!!review.tour?.title && <> · <span className="text-text-secondary">{review.tour.title}</span></>}
                    </p>
                  </div>
                </div>
              </div>
              {!!review.title && <p className="mt-3 text-sm font-semibold text-text-primary">{review.title}</p>}
              {!!review.comment && (
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{review.comment}</p>
              )}
              {!!review.supplierResponse && (
                <div className="mt-3 rounded-lg border border-border bg-surface-muted/40 p-3.5">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Quote className="h-3 w-3" /> Supplier response
                  </p>
                  <p className="text-sm leading-relaxed text-text-secondary">{review.supplierResponse}</p>
                </div>
              )}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StarRow({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-text-tertiary")}
        />
      ))}
    </span>
  );
}

const actionModals: Record<string, { title: string; description: string; hasReason?: boolean; reasonRequired?: boolean; reasonMin?: number; confirmLabel?: string; confirmVariant?: "default" | "destructive" }> = {
  approve: { title: "Approve Application", description: "Approve this supplier application?", hasReason: true, confirmLabel: "Approve", confirmVariant: "default" },
  reject: { title: "Reject Application", description: "Reject this supplier application?", hasReason: true, reasonRequired: true, reasonMin: 10, confirmLabel: "Reject", confirmVariant: "destructive" },
  request_info: { title: "Request Info", description: "Request more information from the supplier?", hasReason: true, reasonRequired: true, reasonMin: 10, confirmLabel: "Request Info", confirmVariant: "default" },
  activate: { title: "Activate Supplier", description: "Activate this supplier? They will be able to create tours.", confirmLabel: "Activate", confirmVariant: "default" },
  suspend: { title: "Suspend Supplier", description: "Suspend this supplier?", hasReason: true, reasonRequired: true, reasonMin: 10, confirmLabel: "Suspend", confirmVariant: "destructive" },
  reactivate: { title: "Reactivate Supplier", description: "Reactivate this supplier?", confirmLabel: "Reactivate", confirmVariant: "default" },
};

function DetailTable({ rows }: { rows: Array<{ label: string; value?: string | null | undefined }> }) {
  const hasValue = rows.some((r) => r.value != null && r.value !== "");
  if (!hasValue) return <p className="py-4 text-center text-sm text-text-tertiary">No information provided</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border bg-surface-muted/40">
          <th className="w-2/5 border-r border-border/70 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Field</th>
          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.label} className={cn("border-b border-border transition-colors last:border-b-0", idx % 2 === 0 ? "bg-surface-base" : "bg-surface-muted/20")}>
            <td className="w-2/5 border-r border-border/70 px-5 py-3.5 align-middle text-xs font-medium text-text-secondary">{r.label}</td>
            <td className="px-5 py-3.5 align-middle leading-relaxed text-text-primary">
              {r.value || <span className="italic text-text-tertiary">Not provided</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface PayoutMethodItem {
  id: string;
  type?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
  branchCode?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  bankCountry?: string;
  currency?: string;
  paypalEmail?: string;
  isDefault?: boolean;
  verified?: boolean;
  createdAt?: string;
}

function PayoutMethodCard({ method }: { method: PayoutMethodItem }) {
  const typeKey = (method.type || "").toLowerCase();
  const isBank = typeKey.includes("bank");
  const isPaypal = typeKey.includes("paypal");
  const scheme = isBank
    ? { badge: "bg-blue-500", bg: "from-blue-50 to-white dark:from-blue-950/30 dark:to-surface-base", border: "border-blue-100 dark:border-blue-800/30", icon: Building2, iconBg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-700 dark:text-blue-300", label: "Bank Account" }
    : isPaypal
    ? { badge: "bg-indigo-500", bg: "from-indigo-50 to-white dark:from-indigo-950/30 dark:to-surface-base", border: "border-indigo-100 dark:border-indigo-800/30", icon: Wallet, iconBg: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-700 dark:text-indigo-300", label: "PayPal Account" }
    : { badge: "bg-emerald-500", bg: "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-surface-base", border: "border-emerald-100 dark:border-emerald-800/30", icon: CreditCard, iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-700 dark:text-emerald-300", label: "Payment Method" };
  const Icon = scheme.icon;
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className={cn("flex items-center justify-between border-b bg-gradient-to-r px-5 py-3.5", scheme.bg, scheme.border)}>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", scheme.iconBg)}>
            <Icon className={cn("h-5 w-5", scheme.iconColor)} />
          </div>
          <div>
            <span className="text-sm font-semibold text-text-primary">{method.type?.replace(/_/g, " ") || "Unknown"}</span>
            <div className="mt-0.5 flex items-center gap-2">
              {method.isDefault && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white", scheme.badge)}>
                  <Check className="h-3 w-3" /> Default
                </span>
              )}
              {method.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-active/10 px-2 py-0.5 text-[11px] font-medium text-status-active">
                  <CheckCircle className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-pending/10 px-2 py-0.5 text-[11px] font-medium text-status-pending">
                  <AlertCircle className="h-3 w-3" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Account Details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {isBank && <Field label="Bank Name" value={method.bankName} />}
            {isBank && <Field label="Account Name" value={method.accountName} />}
            {isBank && <Field label="Account Number" value={method.accountNumber} />}
            {isBank && method.sortCode && <Field label="Sort Code" value={method.sortCode} />}
            {isBank && method.branchCode && <Field label="Branch Code" value={method.branchCode} />}
            {isBank && method.swiftCode && <Field label="SWIFT / BIC" value={method.swiftCode} />}
            {isBank && method.iban && <Field label="IBAN" value={method.iban} />}
            {isBank && method.routingNumber && <Field label="Routing Number" value={method.routingNumber} />}
            {isPaypal && <Field label="PayPal Email" value={method.paypalEmail} />}
            {isPaypal && <Field label="Account Name" value={method.accountName} />}
          </div>
        </div>
        {(method.currency || method.bankCountry) && (
          <div className="flex items-center gap-6 border-t border-border pt-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
              <Globe className="h-3 w-3" /> Region
            </span>
            {method.currency && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-primary">
                {method.currency}
              </span>
            )}
            {method.bankCountry && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-primary">
                {method.bankCountry}
              </span>
            )}
          </div>
        )}
        {method.createdAt && (
          <div className="flex items-center border-t border-border pt-3.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
              <Calendar className="h-3 w-3" />
              Added {formatDate(method.createdAt)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-surface-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text-primary">{value || "—"}</p>
    </div>
  );
}