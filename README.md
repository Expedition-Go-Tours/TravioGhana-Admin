# TravioAfrica Admin Dashboard

Enterprise admin dashboard for TravioAfrica — manage tours, users, suppliers, payouts, reviews, analytics, and platform configuration. Built with React 19, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Dashboard Overview**: 7 KPI cards with count-up animations, revenue breakdown (today/week/month/YTD), top suppliers, top tours, booking status donut chart, recent activity feed, payout summary. Real-time WebSocket updates for new bookings, signups, reviews, tours, and supplier events.
- **Revenue Analytics**: Revenue trend (multi-select bar chart with Revenue/Commission/Supplier Payout), search analytics with charts + DataTable, cart abandonment metrics.
- **User Analytics**: User growth bar chart, customer lifetime value (CLV) pie chart + DataTable, conversion funnel visualization.
- **Tour Performance**: Tour listing with status breakdown, full tour detail view with tabs.
- **Supplier Management**: Application workflow with tabbed interface (All/Pending/Under Review/Approved/Rejected/Active/Suspended), search and pagination, status badges. Active suppliers list. Supplier detail view with 6 tabs (Business, Operating, Representative, Documents, Payout, Compliance).
- **Payouts & Finance**: Payouts overview with summary metrics, paginated payout list with approve/release/fail actions, payout method management per supplier.
- **Review Moderation**: Approve/flag reviews inline with moderation workflow.
- **Chat & Messaging**: Real-time supplier messaging and customer support chat via Socket.IO. Conversation list, message bubbles, new conversation dialog, image upload support.
- **Notifications**: Bell icon with unread count badge, slide-out notification panel with real-time WebSocket updates. Mark all read / individual mark read. Click-to-navigate routing. Supports 11 notification types (booking, payout, review, supplier, system alerts).
- **Admin Settings** (super admin only):
  - **General**: Platform configuration (name, currency, timezone, commission rates, booking rules)
  - **Admin Roles**: Role-based access control with granular permissions (create/edit/delete roles)
  - **Admin Users**: Manage admin users and assign roles
  - **System**: Maintenance mode toggle
  - **Audit Log**: Immutable audit trail with pagination and filters
  - **Email**: Branding configuration (support email, logo URL, hero image URL) with image previews
- **Animations**: Page transitions (framer-motion AnimatePresence), staggered table row animations, card hover lift effects, sidebar collapse/expand animation, count-up number animations.
- **Real-time Updates**: Socket.IO WebSocket connection for live data invalidation and real-time notifications across all pages.
- **Light/Dark Mode**: Full dark theme support via CSS custom properties.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Routing | React Router v6 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Animations | Framer Motion 12 |
| Charts | Recharts |
| Data Fetching | TanStack React Query 5 |
| HTTP Client | Axios (with auth interceptors + token refresh) |
| Auth | Firebase Authentication (email/password + Google) |
| Real-time | Socket.IO Client |
| Icons | Lucide React |
| Toasts | Sonner |
| Deployment | Vercel (SPA with rewrites) |

## Page Structure & Routes

All routes are protected by Firebase authentication and role-based permissions.

| Path | Permission | Page | Description |
|------|-----------|------|-------------|
| `/admin/login` | Public | Login | Firebase email/password + Google sign-in |
| `/admin/overview` | Always | Overview | Dashboard home with KPI cards, charts, activity feed |
| `/admin/revenue-trend` | `analytics.view` | RevenueTrend | Monthly revenue bar chart |
| `/admin/search-analytics` | `analytics.view` | SearchAnalytics | Search data with charts |
| `/admin/cart-abandonment` | `analytics.view` | CartAbandonment | Cart abandonment metrics |
| `/admin/user-growth` | `users.view` | UserGrowth | User growth bar chart |
| `/admin/clv` | `users.view` | CustomerLifetimeValue | CLV pie chart + DataTable |
| `/admin/funnel` | `users.view` | ConversionFunnel | Funnel visualization |
| `/admin/tours` | `tours.view` | TourPerformance | Tour listing with status |
| `/admin/tours/:id` | `tours.view` | TourDetail | Full tour detail view |
| `/admin/suppliers` | `suppliers.view` | SupplierApplications | Application workflow |
| `/admin/suppliers/:id` | `suppliers.view` | SupplierDetail | 6-tab supplier detail |
| `/admin/suppliers/active` | `suppliers.view` | ActiveSuppliers | Approved/active suppliers |
| `/admin/payouts` | `payouts.view` | PayoutsTabPage | Overview + All Payouts tabs |
| `/admin/payout-methods` | `payout-methods.view` | PayoutMethods | Supplier payout methods |
| `/admin/reviews` | `reviews.view` | ReviewModeration | Approve/flag reviews |
| `/admin/chat/suppliers` | `chat.suppliers` | ChatPage | Supplier messaging |
| `/admin/chat/customers` | `chat.customers` | ChatPage | Customer support chat |
| `/admin/settings` | `settings.access` | SettingsPage | Platform configuration (6 tabs) |

## Authentication

The dashboard uses Firebase Authentication with a custom permission system.

### Flow

1. Admin signs in via email/password or Google on the login page
2. Firebase verifies credentials and returns an ID token
3. Dashboard stores the token in `localStorage` and verifies admin role via API
4. All subsequent API calls include `Authorization: Bearer <token>` via Axios interceptor
5. Token auto-refresh on 401 responses via `user.getIdToken(true)`

### Permission System

- **Roles**: Granular admin roles (e.g., `super_admin`, `finance_admin`, `support_admin`)
- **Permissions**: Dot-notation keys (e.g., `analytics.view`, `payouts.approve`, `suppliers.view`)
- **Wildcard Support**: `dashboard.*` grants all dashboard permissions
- **Route Guards**: `<ProtectedRoute>` (auth check) and `<PermissionRoute>` (permission check) nested wrappers
- **UI Guards**: Sidebar items, buttons, and tabs conditionally rendered via `can()` and `isSuperAdmin()` hooks

## API Endpoints Consumed

The dashboard communicates with the backend API via Axios (base URL configured in `.env`).

### Analytics & Overview
| Endpoint | Purpose |
|----------|---------|
| `GET /admin/analytics/overview` | Dashboard KPI data, revenue breakdown, top lists |
| `GET /admin/analytics/revenue-trend` | Monthly revenue time-series |
| `GET /admin/analytics/search-analytics` | Search query analytics |
| `GET /admin/analytics/cart-abandonment` | Cart abandonment data |
| `GET /admin/users/active` | Currently active users list |
| `GET /admin/users/new-signups` | Recent signups list |
| `GET /admin/bookings/today` | Today's bookings list |

### Admin
| Endpoint | Purpose |
|----------|---------|
| `GET /admin/me` | Current admin user data |
| `GET /admin/roles` | Role definitions and permissions |
| `GET /admin/notifications` | Admin notifications list |
| `GET /admin/notifications/unread-count` | Unread notification badge count |
| `PATCH /admin/notifications/:id/acknowledge` | Mark notification as read |
| `PATCH /admin/notifications/acknowledge-all` | Mark all notifications as read |

### Chat
| Endpoint | Purpose |
|----------|---------|
| `GET /chat/conversations` | List conversations |
| `GET /chat/conversations/:id/messages` | Get conversation messages |
| `POST /chat/conversations` | Create new conversation |
| `POST /chat/conversations/:id/messages` | Send message |
| `PATCH /chat/conversations/:id/read` | Mark conversation read |
| `GET /chat/conversations/unread-count` | Unread conversations count |
| `GET /admin/users/search` | Search users to start chat |
| `POST /chat/upload` | Upload chat image attachment |

### WebSocket Events (Socket.IO)

The dashboard listens for real-time events via Socket.IO for live data invalidation:

- `admin:signup` — New user signup
- `admin:new-booking` — New booking created
- `admin:new-review` — New review submitted
- `admin:new-tour` — New tour published
- `admin:tour-update` — Tour updated
- `admin:supplier-application` — New supplier application
- `admin:supplier-status-change` — Supplier status changed
- `admin:payout-update` — Payout status changed
- `data-change` — Generic model-based query invalidation
- `admin-notification` — Real-time admin notification push
- `chat:message`, `chat:typing`, `chat:mark-read`, etc. — Chat events

## Project Structure

```
src/
├── auth/                    # Firebase auth hooks, route guards (ProtectedRoute, useAdminRole, useAuth)
├── components/
│   ├── layout/              # AppLayout (sidebar + header + content), Sidebar (collapsible), Header (breadcrumbs + notifications + user menu)
│   ├── shared/              # DataTable, KPICard, StatusBadge, SafeImage, ConfirmModal, SectionEmpty, SectionError, AnimatedNumber
│   ├── skiper/              # AnimatedCard (hover lift effect)
│   └── ui/                  # shadcn primitives: button, card, dialog, input, label, select, skeleton, tabs, textarea, badge, NotificationBell
├── hooks/                   # Custom hooks: useChatSocket, useDataSocket, usePermission, useSocketEvent
├── lib/                     # Axios instance (auth interceptor), Firebase config, QueryClient, animations (framer-motion variants), permissions (TypeScript), utils (cn, formatCurrency, timeAgo, etc.), adminSocket singleton
├── pages/
│   ├── Login.tsx            # Firebase sign-in page (email/password + Google)
│   ├── Overview.tsx         # Dashboard home page (KPIs, charts, tables, modals)
│   ├── chat/                # ChatPage, ChatWindow, ConversationList, MessageBubble, NewConversationDialog
│   ├── finance/             # PayoutsOverview, PayoutsList, PayoutMethods
│   ├── revenue/             # RevenueTrend, SearchAnalytics, CartAbandonment
│   ├── reviews/             # ReviewModeration
│   ├── settings/            # SettingsPage (6 tabs: General, Roles, AdminUsers, System, AuditLog, Email)
│   ├── suppliers/           # SupplierApplications, ActiveSuppliers, SupplierDetail
│   ├── tours/               # TourPerformance, TourDetail
│   └── users/               # UserGrowth, CustomerLifetimeValue, ConversionFunnel
├── services/                # chatService, notificationService
├── App.tsx                  # Route definitions with permission guards
├── main.tsx                 # React entry point (StrictMode + createRoot)
└── index.css                # Tailwind directives, CSS custom properties (light + dark themes)
```

## Prerequisites

- Node.js 20 or higher
- npm
- Firebase project with Authentication enabled (email/password + Google)
- Backend API running (Express + Prisma + PostgreSQL)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Expedition-Go-Tours/TravioAfricaAdmin.git
   cd TravioAfricaAdmin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root:

   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # Backend API
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   Opens at `http://localhost:8080`.

### Build

```bash
npm run build
```

Output in `dist/` — deploy to any static host.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_API_URL` | Yes | Backend API base URL (e.g., `http://localhost:5000/api`) |

## Theme System

The dashboard supports light and dark themes via CSS custom properties defined in `src/index.css`:

- **Light**: Default (`:root`) — white backgrounds, green accents, dark text
- **Dark**: `.dark` class — dark backgrounds, adjusted green scale, light text

Color tokens include full green scale (`green-50` through `green-900`), status colors (pending, approved, active, rejected, suspended, flagged, processing), chart colors (5-color palette), and shadcn standard tokens. The sidebar uses a gradient `from-green-700 to-green-800`.

## Deployment

1. Build: `npm run build`
2. Deploy the `dist/` directory to any static host:

   | Platform | Notes |
   |----------|-------|
   | **Vercel** | SPA rewrites configured in `vercel.json` for client-side routing |
   | **Netlify** | Add `/* /index.html 200` redirect rule |
   | **Render Static** | Publish `dist/` directory |
   | **Cloudflare Pages** | Set build command to `npm run build`, output to `dist` |

3. Set all environment variables on the host
4. Ensure the backend `VITE_API_URL` points to the live backend

## Related

- **Backend API**: https://github.com/Expedition-Go-Tours/Expedition-Go-Backend-v2
- **Storefront**: https://travioafrica.com

---

**Last Updated**: June 12, 2026
**Version**: 1.0.0
