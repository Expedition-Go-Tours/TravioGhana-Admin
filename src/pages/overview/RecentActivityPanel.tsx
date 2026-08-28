import { useState } from "react";
import { Search, Calendar, User, FileText, Star, AlertCircle, MessageSquare, Bell, Banknote, Building, Tag, UserPlus, Shield, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Activity {
  id?: string;
  type: "booking" | "user" | "review" | "alert" | "update" | "message" | "payout" | "supplier" | "offer" | "team" | "role" | "webhook";
  title: string;
  description: string;
  timestamp: string;
  ticketId?: string;
}

interface RecentActivityPanelProps {
  activities?: Activity[];
  loading?: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  booking: <Calendar className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  review: <Star className="h-4 w-4" />,
  alert: <AlertCircle className="h-4 w-4" />,
  update: <FileText className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  payout: <Banknote className="h-4 w-4" />,
  supplier: <Building className="h-4 w-4" />,
  offer: <Tag className="h-4 w-4" />,
  team: <UserPlus className="h-4 w-4" />,
  role: <Shield className="h-4 w-4" />,
  webhook: <Activity className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  booking: "bg-blue-500",
  user: "bg-status-active",
  review: "bg-amber-500",
  alert: "bg-red-500",
  update: "bg-violet-500",
  message: "bg-cyan-500",
  payout: "bg-green-500",
  supplier: "bg-orange-500",
  offer: "bg-pink-500",
  team: "bg-indigo-500",
  role: "bg-text-secondary",
  webhook: "bg-teal-500",
};

export function RecentActivityPanel({ activities = [], loading }: RecentActivityPanelProps) {
  const [activeTab, setActiveTab] = useState("today");
  const [searchQuery, setSearchQuery] = useState("");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const timeFiltered = activities.filter((activity) => {
    if (!activity.timestamp) return true;
    const date = new Date(activity.timestamp);
    switch (activeTab) {
      case "today":
        return date >= todayStart;
      case "yesterday":
        return date >= yesterdayStart && date < todayStart;
      case "week":
        return date >= weekStart;
      default:
        return true;
    }
  });

  const filteredActivities = timeFiltered.filter(
    (activity) =>
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="h-full border border-border/60 shadow-soft bg-surface-base rounded-2xl">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <Bell className="h-4 w-4" />
            </span>
            Recent Activity
          </CardTitle>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full bg-surface-muted rounded-lg p-1">
            <TabsTrigger value="today" className="flex-1 text-xs font-medium rounded-md data-[state=active]:bg-surface-base data-[state=active]:text-text-primary data-[state=active]:shadow-sm">Today</TabsTrigger>
            <TabsTrigger value="yesterday" className="flex-1 text-xs font-medium rounded-md data-[state=active]:bg-surface-base data-[state=active]:text-text-primary data-[state=active]:shadow-sm">Yesterday</TabsTrigger>
            <TabsTrigger value="week" className="flex-1 text-xs font-medium rounded-md data-[state=active]:bg-surface-base data-[state=active]:text-text-primary data-[state=active]:shadow-sm">This week</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search activities"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-surface-muted border-border rounded-lg"
          />
        </div>
        <p className="text-xs text-text-secondary mt-3">{filteredActivities.length} new activities {activeTab === "today" ? "today" : activeTab === "yesterday" ? "yesterday" : "this week"}</p>
      </CardHeader>
      <CardContent className="p-0 px-5 pb-5">
        <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-border/60">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse py-3">
                  <div className="h-9 w-9 rounded-full bg-surface-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 bg-surface-muted rounded" />
                    <div className="h-2.5 w-36 bg-surface-muted rounded" />
                  </div>
                  <div className="h-2.5 w-12 bg-surface-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-secondary">No activities found</div>
          ) : (
            filteredActivities.map((activity, index) => (
              <div key={activity.id || index} className="flex items-start gap-3 py-3.5 hover:bg-surface-muted rounded-lg transition-colors cursor-pointer">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", activityColors[activity.type])}>
                  {activityIcons[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{activity.title}</p>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{activity.description}</p>
                  {activity.ticketId && (
                    <p className="text-[10px] text-text-tertiary mt-1">Ticket {activity.ticketId}</p>
                  )}
                </div>
                <span className="text-[11px] text-text-tertiary whitespace-nowrap">{timeAgo(activity.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
