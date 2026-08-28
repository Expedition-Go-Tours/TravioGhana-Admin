import {
  LayoutDashboard,
  TrendingUp,
  Search,
  ShoppingCart,
  Users,
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
  Brain,
} from "lucide-react";

export interface ChildItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  badgeKey?: "bookings" | "reviews" | "tours";
  keywords?: string[];
  children?: ChildItem[];
}

export function getNavGroups(can: (key: string) => boolean): { group: string; items: NavItem[] }[] {
  const analyticsItems: NavItem[] = [
    ...(can('dashboard.*') || can('analytics.view') ? [{ label: "Overview", path: "/admin/overview", icon: <LayoutDashboard className="h-4 w-4" />, keywords: ["home", "dashboard"] }] : []),
    ...(can('analytics.view') ? [{
      label: "Revenue",
      icon: <TrendingUp className="h-4 w-4" />,
      keywords: ["sales", "money", "income"],
      children: [
        { label: "Revenue Trend", path: "/admin/revenue-trend", icon: <BarChart3 className="h-4 w-4" /> },
        { label: "Search Analytics", path: "/admin/search-analytics", icon: <Search className="h-4 w-4" /> },
        { label: "Cart Abandonment", path: "/admin/cart-abandonment", icon: <ShoppingCart className="h-4 w-4" /> },
      ],
    }] : []),
    ...(can('users.view') || can('chat.customers') ? [{
      label: "Users",
      icon: <Users className="h-4 w-4" />,
      keywords: ["accounts", "customers", "people"],
      children: [
        ...(can('chat.customers') ? [{ label: "Customer Support", path: "/admin/chat/customers", icon: <MessageSquare className="h-4 w-4" /> }] : []),
        ...(can('users.view') ? [{ label: "User Growth", path: "/admin/user-growth", icon: <UserCog className="h-4 w-4" /> }] : []),
        ...(can('users.view') ? [{ label: "CLV", path: "/admin/clv", icon: <DollarSign className="h-4 w-4" /> }] : []),
        ...(can('users.view') ? [{ label: "Conversion Funnel", path: "/admin/funnel", icon: <Target className="h-4 w-4" /> }] : []),
      ],
    }] : []),
    ...(can('tours.view') ? [{ label: "Tours", path: "/admin/tours", icon: <Map className="h-4 w-4" />, keywords: ["products", "listings"] }] : []),
  ].filter((i) => !i.children || i.children.length > 0);

  const managementItems: NavItem[] = [
    ...(can('bookings.view') ? [{ label: "Bookings", path: "/admin/bookings", icon: <ShoppingCart className="h-4 w-4" />, badgeKey: "bookings" as const, keywords: ["reservation", "orders"] }] : []),
    ...(can('suppliers.view') ? [{ label: "Suppliers", path: "/admin/suppliers", icon: <UserPlus className="h-4 w-4" />, keywords: ["vendors", "partners"] }] : []),
    ...(can('suppliers.view') ? [{ label: "Quality Control", path: "/admin/quality-control", icon: <ClipboardCheck className="h-4 w-4" />, keywords: ["qc", "standards", "checks"] }] : []),
    ...(can('tours.view') ? [{ label: "Travio Ghana", path: "/admin/expedition", icon: <Globe className="h-4 w-4" />, keywords: ["ghana", "expeditions"] }] : []),
    ...(can('reviews.view') ? [{ label: "Reviews", path: "/admin/reviews", icon: <Star className="h-4 w-4" />, badgeKey: "reviews" as const, keywords: ["ratings", "feedback"] }] : []),
    ...(can('tours.approve') ? [{ label: "Tour Moderation", path: "/admin/tour-moderation", icon: <ClipboardCheck className="h-4 w-4" />, badgeKey: "tours" as const, keywords: ["approve", "approval"] }] : []),
    ...(can('chat.suppliers') ? [{ label: "Supplier Messages", path: "/admin/chat/suppliers", icon: <Building className="h-4 w-4" />, keywords: ["inbox", "messages"] }] : []),
    ...(can('blog.manage') ? [{ label: "Blog", path: "/admin/blog", icon: <FileText className="h-4 w-4" />, keywords: ["posts", "articles", "content"] }] : []),
    ...(can('tours.view') ? [{ label: "AI Processing", path: "/admin/ai-processing", icon: <Brain className="h-4 w-4" />, keywords: ["mimo", "ai", "image", "classification"] }] : []),
  ];

  const financeItems: NavItem[] = [
    ...(can('payouts.view') || can('payout-methods.view') ? [{ label: "Payouts", path: "/admin/payouts", icon: <Banknote className="h-4 w-4" />, keywords: ["payments", "withdraw", "bank", "finance"] }] : []),
  ];

  const groups: { group: string; items: NavItem[] }[] = [];
  if (analyticsItems.length > 0) groups.push({ group: "Analytics", items: analyticsItems });
  if (managementItems.length > 0) groups.push({ group: "Management", items: managementItems });
  if (financeItems.length > 0) groups.push({ group: "Finance", items: financeItems });
  return groups;
}
