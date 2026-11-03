import { createBrowserRouter, RouterProvider, Navigate, useLocation } from "react-router-dom";
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
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import AuthCallback from "@/pages/auth/AuthCallback";
import OverviewPage from "@/pages/Overview";
import RevenueTrendPage from "@/pages/revenue/RevenueTrend";
import UserGrowthPage from "@/pages/users/UserGrowth";
import CustomerLifetimeValuePage from "@/pages/users/CustomerLifetimeValue";
import ConversionFunnelPage from "@/pages/users/ConversionFunnel";
import TourPerformancePage from "@/pages/tours/TourPerformance";
import TourDetailPage from "@/pages/tours/TourDetail";
import TourModerationPage from "@/pages/tours/TourModeration";
import SupplierApplicationsPage from "@/pages/suppliers/SupplierApplications";
import SupplierDetailPage from "@/pages/suppliers/SupplierDetail";
import SupplierQcDashboardPage from "@/pages/suppliers/SupplierQcDashboard";
import PayoutsPage from "@/pages/finance/PayoutsPage";
import ReviewModerationPage from "@/pages/reviews/ReviewModeration";
import BookingsPage from "@/pages/bookings/BookingsPage";
import CancellationsPage from "@/pages/cancellations/CancellationsPage";
import RefundRequestsPage from "@/pages/refund-requests/RefundRequestsPage";
import ChatPage from "@/pages/chat/ChatPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ActivityLogPage from "@/pages/activity/ActivityLogPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
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

function PermissionRoute({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const { data: role, isLoading } = useAdminRole();

  if (isLoading) return null;
  if (!role) return <Navigate to="/admin" replace />;
  if (role.name === "super_admin") return <>{children}</>;
  const keys = Array.isArray(permission) ? permission : [permission];
  if (!keys.some((key) => role.permissions?.includes(key))) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}

/**
 * Ops emails and the notification feed deep-link to the queue as
 * `/cancellations?request=<id>` (the admin app is mounted under `/admin`).
 * Preserve the query string when normalising into the router.
 */
function CancellationsRedirect() {
  const location = useLocation();
  return <Navigate to={`/admin/cancellations${location.search}`} replace />;
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
  { path: "/admin/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/admin/reset-password", element: <ResetPasswordPage /> },
  { path: "/auth/callback", element: <AuthCallback /> },
  { path: "/cancellations", element: <CancellationsRedirect /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "overview", element: <OverviewPage /> },
      { path: "revenue-trend", element: <PermissionRoute permission="analytics.view"><RevenueTrendPage /></PermissionRoute> },
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
      { path: "payouts", element: <PermissionRoute permission="payouts.view"><PayoutsPage /></PermissionRoute> },
      { path: "payout-methods", element: <PermissionRoute permission="payout-methods.view"><Navigate to="/admin/payouts?tab=methods" replace /></PermissionRoute> },
      { path: "bookings", element: <PermissionRoute permission="bookings.view"><BookingsPage /></PermissionRoute> },
      { path: "cancellations", element: <PermissionRoute permission={["bookings.view", "dashboard.*"]}><CancellationsPage /></PermissionRoute> },
      { path: "refund-requests", element: <PermissionRoute permission={["bookings.view", "dashboard.*"]}><RefundRequestsPage /></PermissionRoute> },
      { path: "reviews", element: <PermissionRoute permission="reviews.view"><ReviewModerationPage /></PermissionRoute> },
      { path: "chat/suppliers", element: <PermissionRoute permission="chat.suppliers"><ChatPage /></PermissionRoute> },
      { path: "chat/customers", element: <PermissionRoute permission="chat.customers"><ChatPage /></PermissionRoute> },
      { path: "chat/expedition", element: <PermissionRoute permission="chat.expedition"><ChatPage /></PermissionRoute> },
      { path: "settings", element: <PermissionRoute permission="settings.access"><SettingsPage /></PermissionRoute> },
      { path: "activity-log", element: <PermissionRoute permission="settings.access"><ActivityLogPage /></PermissionRoute> },
      { path: "notifications", element: <PermissionRoute permission="notifications.view"><NotificationsPage /></PermissionRoute> },
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