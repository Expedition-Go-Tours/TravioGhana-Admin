import {
  LayoutDashboard,
  ShoppingCart,
  DollarSign,
  Map,
  UserPlus,
  Banknote,
  Star,
  Building,
  BarChart3,
  UserCog,
  Target,
  ClipboardCheck,
  Globe,
  FileText,
  MessageSquare,
  ShieldAlert,
  Wallet,
  Bell,
  Briefcase,
  Compass,
  LineChart,
  MessagesSquare,
  Settings2,
  History,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badgeKey?: "bookings" | "reviews" | "tours" | "cancellations" | "notifications";
  keywords?: string[];
}

export interface NavGroup {
  group: string;
  /** Rail icon used when the sidebar is collapsed. */
  icon: React.ReactNode;
  items: NavItem[];
}

export function getNavGroups(can: (key: string) => boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      group: "Overview",
      icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
      items: can("dashboard.*") || can("analytics.view")
        ? [{ label: "Overview", path: "/admin/overview", icon: <LayoutDashboard className="h-4 w-4" />, keywords: ["home", "dashboard"] }]
        : [],
    },
    {
      group: "Operations",
      icon: <Briefcase className="h-[18px] w-[18px]" />,
      items: [
        ...(can("bookings.view")
          ? [{ label: "Bookings", path: "/admin/bookings", icon: <ShoppingCart className="h-4 w-4" />, badgeKey: "bookings" as const, keywords: ["reservation", "orders"] }]
          : []),
        ...(can("bookings.view") || can("dashboard.*")
          ? [{ label: "Cancellations", path: "/admin/cancellations", icon: <ShieldAlert className="h-4 w-4" />, badgeKey: "cancellations" as const, keywords: ["approval", "refund", "supplier cancel"] }]
          : []),
        ...(can("bookings.view") || can("dashboard.*")
          ? [{ label: "Refund requests", path: "/admin/refund-requests", icon: <Wallet className="h-4 w-4" />, keywords: ["supplier refund", "balance", "approval"] }]
          : []),
        ...(can("suppliers.view")
          ? [{ label: "Suppliers", path: "/admin/suppliers", icon: <UserPlus className="h-4 w-4" />, keywords: ["vendors", "partners"] }]
          : []),
        ...(can("suppliers.view")
          ? [{ label: "Quality Control", path: "/admin/quality-control", icon: <ClipboardCheck className="h-4 w-4" />, keywords: ["qc", "standards", "checks"] }]
          : []),
      ],
    },
    {
      group: "Catalog",
      icon: <Compass className="h-[18px] w-[18px]" />,
      items: [
        ...(can("tours.view")
          ? [{ label: "Tours", path: "/admin/tours", icon: <Map className="h-4 w-4" />, keywords: ["products", "listings"] }]
          : []),
        ...(can("tours.approve")
          ? [{ label: "Tour Moderation", path: "/admin/tour-moderation", icon: <ClipboardCheck className="h-4 w-4" />, badgeKey: "tours" as const, keywords: ["approve", "approval"] }]
          : []),
        ...(can("tours.view")
          ? [{ label: "Expedition-Go Tours", path: "/admin/expedition", icon: <Globe className="h-4 w-4" />, keywords: ["ghana", "expeditions"] }]
          : []),
      ],
    },
    {
      group: "Insights",
      icon: <LineChart className="h-[18px] w-[18px]" />,
      items: [
        ...(can("analytics.view")
          ? [{ label: "Revenue Trend", path: "/admin/revenue-trend", icon: <BarChart3 className="h-4 w-4" />, keywords: ["sales", "money", "income", "revenue"] }]
          : []),
        ...(can("users.view")
          ? [{ label: "User Growth", path: "/admin/user-growth", icon: <UserCog className="h-4 w-4" />, keywords: ["accounts", "people"] }]
          : []),
        ...(can("users.view")
          ? [{ label: "Customer Lifetime Value", path: "/admin/clv", icon: <DollarSign className="h-4 w-4" />, keywords: ["clv", "lifetime"] }]
          : []),
        ...(can("users.view")
          ? [{ label: "Conversion Funnel", path: "/admin/funnel", icon: <Target className="h-4 w-4" />, keywords: ["funnel", "conversion"] }]
          : []),
      ],
    },
    {
      group: "Engagement",
      icon: <MessagesSquare className="h-[18px] w-[18px]" />,
      items: [
        ...(can("reviews.view")
          ? [{ label: "Reviews", path: "/admin/reviews", icon: <Star className="h-4 w-4" />, badgeKey: "reviews" as const, keywords: ["ratings", "feedback"] }]
          : []),
        ...(can("blog.manage")
          ? [{ label: "Blog", path: "/admin/blog", icon: <FileText className="h-4 w-4" />, keywords: ["posts", "articles", "content"] }]
          : []),
        ...(can("chat.customers")
          ? [{ label: "Customer Support", path: "/admin/chat/customers", icon: <MessageSquare className="h-4 w-4" />, keywords: ["chat", "inbox", "messages"] }]
          : []),
        ...(can("chat.suppliers")
          ? [{ label: "Supplier Messages", path: "/admin/chat/suppliers", icon: <Building className="h-4 w-4" />, keywords: ["inbox", "messages"] }]
          : []),
        ...(can("notifications.view")
          ? [{ label: "Notifications", path: "/admin/notifications", icon: <Bell className="h-4 w-4" />, badgeKey: "notifications" as const, keywords: ["alerts", "unread", "inbox", "updates"] }]
          : []),
      ],
    },
    {
      group: "Finance",
      icon: <Wallet className="h-[18px] w-[18px]" />,
      items: can("payouts.view") || can("payout-methods.view")
        ? [{ label: "Payouts", path: "/admin/payouts", icon: <Banknote className="h-4 w-4" />, keywords: ["payments", "withdraw", "bank", "finance"] }]
        : [],
    },
    {
      group: "System",
      icon: <Settings2 className="h-[18px] w-[18px]" />,
      items: [
        ...(can("settings.access")
          ? [{ label: "Activity Log", path: "/admin/activity-log", icon: <History className="h-4 w-4" />, keywords: ["audit", "history"] }]
          : []),
        ...(can("settings.access")
          ? [{ label: "Settings", path: "/admin/settings", icon: <Settings className="h-4 w-4" />, keywords: ["config", "preferences"] }]
          : []),
      ],
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}
