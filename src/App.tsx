import { createBrowserRouter, RouterProvider, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { useAdminRole } from "@/auth/useAdminRole";
import { useAuthContext } from "@/auth/auth-context";
import { getDefaultRoute } from "@/lib/permissions";
import { useDataSocket } from "@/hooks/useDataSocket";

import LoginPage from "@/pages/Login";
import AuthCallback from "@/pages/auth/AuthCallback";
import OverviewPage from "@/pages/Overview";
import RevenueTrendPage from "@/pages/revenue/RevenueTrend";
import SearchAnalyticsPage from "@/pages/revenue/SearchAnalytics";
import CartAbandonmentPage from "@/pages/revenue/CartAbandonment";
import UserGrowthPage from "@/pages/users/UserGrowth";
import CustomerLifetimeValuePage from "@/pages/users/CustomerLifetimeValue";
import ConversionFunnelPage from "@/pages/users/ConversionFunnel";
import TourPerformancePage from "@/pages/tours/TourPerformance";
import TourDetailPage from "@/pages/tours/TourDetail";
import TourModerationPage from "@/pages/tours/TourModeration";
import SupplierApplicationsPage from "@/pages/suppliers/SupplierApplications";
import SupplierDetailPage from "@/pages/suppliers/SupplierDetail";
import SupplierQcDashboardPage from "@/pages/suppliers/SupplierQcDashboard";
import { ArrowLeft } from "lucide-react";
import { PayoutsPaymentsTab } from "@/pages/finance/components/PayoutsPaymentsTab";
import { PayoutsListTab } from "@/pages/finance/components/PayoutsListTab";
import { PayoutsMethodsTab } from "@/pages/finance/components/PayoutsMethodsTab";
import { PayoutRequestsTab } from "@/pages/finance/components/PayoutRequestsTab";
import { DisputesQueueTab } from "@/pages/finance/components/DisputesQueueTab";
import ReviewModerationPage from "@/pages/reviews/ReviewModeration";
import BookingsPage from "@/pages/bookings/BookingsPage";
import ChatPage from "@/pages/chat/ChatPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ActivityLogPage from "@/pages/activity/ActivityLogPage";
import BlogListPage from "@/pages/blog/BlogListPage";
import BlogPreviewPage from "@/pages/blog/BlogPreviewPage";
import BlogEditorPage from "@/pages/blog/BlogEditorPage";
import CategoryManagerPage from "@/pages/blog/CategoryManagerPage";
import TagManagerPage from "@/pages/blog/TagManagerPage";
import BlogAnalytics from "@/pages/blog/BlogAnalytics";
import ExpeditionListingsPage from "@/pages/expedition/ExpeditionListingsPage";
import AiProcessingPage from "@/pages/ai/AiProcessingPage";

function DataSocketInit() {
  const { isAuthenticated } = useAuthContext();
  useDataSocket(isAuthenticated);
  return null;
}

function HomeRedirect() {
  return <Navigate to={getDefaultRoute()} replace />;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { data: role, isLoading } = useAdminRole();

  if (isLoading) return null;
  if (!role) return <Navigate to="/admin" replace />;
  if (role.name === "super_admin") return <>{children}</>;
  if (!role.permissions?.includes(permission)) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}

type PayoutTab = "payments" | "requests" | "payouts" | "disputes" | "methods";

function PayoutsTabPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: PayoutTab = (["payments", "requests", "payouts", "disputes", "methods"] as const).find((t) => searchParams.get("tab") === t) ?? "payments";
  const [statusOverride, setStatusOverride] = useState<string | undefined>(undefined);

  const switchTab = (t: PayoutTab) => {
    const next = new URLSearchParams(searchParams);
    if (t === "payments") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
    setStatusOverride(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-base text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4 text-text-primary" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Payouts</h1>
          <p className="mt-0.5 text-sm text-text-tertiary">Manage supplier payouts across approval, release, and settlement</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-border-muted">
        {([
          { key: "payments", label: "Payments" },
          { key: "requests", label: "Payout Requests" },
          { key: "payouts", label: "All Payouts" },
          { key: "disputes", label: "Refund Requests" },
          { key: "methods", label: "Supplier Methods" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
              tab === key
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary hover:text-primary"
            }`}
            onClick={() => switchTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "payments" && <PayoutsPaymentsTab onSwitchToList={(status) => { setStatusOverride(status); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("tab", "payouts"); return next; }, { replace: true }); }} onSwitchToRequests={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("tab", "requests"); return next; }, { replace: true })} />}
      {tab === "requests" && <PayoutRequestsTab />}
      {tab === "payouts" && <PayoutsListTab initialStatus={statusOverride} onStatusChange={setStatusOverride} />}
      {tab === "disputes" && <DisputesQueueTab />}
      {tab === "methods" && <PayoutsMethodsTab />}
    </div>
  );
}

function AdminLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: "/admin/login", element: <LoginPage /> },
  { path: "/auth/callback", element: <AuthCallback /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "overview", element: <OverviewPage /> },
      { path: "revenue-trend", element: <PermissionRoute permission="analytics.view"><RevenueTrendPage /></PermissionRoute> },
      { path: "search-analytics", element: <PermissionRoute permission="analytics.view"><SearchAnalyticsPage /></PermissionRoute> },
      { path: "cart-abandonment", element: <PermissionRoute permission="analytics.view"><CartAbandonmentPage /></PermissionRoute> },
      { path: "user-growth", element: <PermissionRoute permission="users.view"><UserGrowthPage /></PermissionRoute> },
      { path: "clv", element: <PermissionRoute permission="users.view"><CustomerLifetimeValuePage /></PermissionRoute> },
      { path: "funnel", element: <PermissionRoute permission="users.view"><ConversionFunnelPage /></PermissionRoute> },
      { path: "tours", element: <PermissionRoute permission="tours.view"><TourPerformancePage /></PermissionRoute> },
      { path: "tours/:id", element: <PermissionRoute permission="tours.view"><TourDetailPage /></PermissionRoute> },
      { path: "tour-moderation", element: <PermissionRoute permission="tours.view"><TourModerationPage /></PermissionRoute> },
      { path: "suppliers", element: <PermissionRoute permission="suppliers.view"><SupplierApplicationsPage /></PermissionRoute> },
      { path: "suppliers/:id", element: <PermissionRoute permission="suppliers.view"><SupplierDetailPage /></PermissionRoute> },
      { path: "suppliers/active", element: <Navigate to="/admin/suppliers" replace /> },
      { path: "quality-control", element: <PermissionRoute permission="suppliers.view"><SupplierQcDashboardPage /></PermissionRoute> },
      { path: "payouts", element: <PermissionRoute permission="payouts.view"><PayoutsTabPage /></PermissionRoute> },
      { path: "payout-methods", element: <PermissionRoute permission="payout-methods.view"><Navigate to="/admin/payouts?tab=methods" replace /></PermissionRoute> },
      { path: "bookings", element: <PermissionRoute permission="bookings.view"><BookingsPage /></PermissionRoute> },
      { path: "reviews", element: <PermissionRoute permission="reviews.view"><ReviewModerationPage /></PermissionRoute> },
      { path: "chat/suppliers", element: <PermissionRoute permission="chat.suppliers"><ChatPage /></PermissionRoute> },
      { path: "chat/customers", element: <PermissionRoute permission="chat.customers"><ChatPage /></PermissionRoute> },
      { path: "settings", element: <PermissionRoute permission="settings.access"><SettingsPage /></PermissionRoute> },
      { path: "activity-log", element: <PermissionRoute permission="settings.access"><ActivityLogPage /></PermissionRoute> },
      { path: "blog", element: <PermissionRoute permission="blog.manage"><BlogListPage /></PermissionRoute> },
      { path: "blog/preview/:id", element: <PermissionRoute permission="blog.manage"><BlogPreviewPage /></PermissionRoute> },
      { path: "blog/new", element: <PermissionRoute permission="blog.manage"><BlogEditorPage /></PermissionRoute> },
      { path: "blog/:id", element: <PermissionRoute permission="blog.manage"><BlogEditorPage /></PermissionRoute> },
      { path: "blog/categories", element: <PermissionRoute permission="blog.manage"><CategoryManagerPage /></PermissionRoute> },
      { path: "blog/tags", element: <PermissionRoute permission="blog.manage"><TagManagerPage /></PermissionRoute> },
      { path: "blog/analytics", element: <PermissionRoute permission="blog.manage"><BlogAnalytics /></PermissionRoute> },
      { path: "expedition", element: <PermissionRoute permission="tours.view"><ExpeditionListingsPage /></PermissionRoute> },
      { path: "ai-processing", element: <PermissionRoute permission="tours.view"><AiProcessingPage /></PermissionRoute> },
    ],
  },
  { path: "*", element: <Navigate to={getDefaultRoute()} replace /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataSocketInit />
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              borderRadius: "8px",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
