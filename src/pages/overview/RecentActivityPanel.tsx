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

const greenActivityTypes = new Set(["booking", "user", "update", "message", "payout", "team", "webhook"]);

const activityColors: Record<string, string> = {
  booking: "bg-status-approved",
  user: "bg-status-active",
  review: "bg-status-pending",
  alert: "bg-status-rejected",
  update: "bg-status-processing",
  message: "bg-status-approved",
  payout: "bg-primary/100",
  supplier: "bg-status-pending",
  offer: "bg-status-rejected",
  team: "bg-primary",
  role: "bg-text-secondary",
  webhook: "bg-primary",
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
    <Card className="flex h-full max-h-[400px] flex-col border border-border bg-surface-base">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </span>
            Recent Activity
            <span className="tnum ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
              {filteredActivities.length}
            </span>
          </CardTitle>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
          <TabsList className="h-9 w-full rounded-lg border-b-0 bg-surface-muted p-1">
            <TabsTrigger value="today" className="min-w-0 flex-1 shrink rounded-md px-2 text-[11px] font-medium data-[state=active]:bg-surface-base data-[state=active]:font-semibold data-[state=active]:text-text-primary">Today</TabsTrigger>
            <TabsTrigger value="yesterday" className="min-w-0 flex-1 shrink rounded-md px-2 text-[11px] font-medium data-[state=active]:bg-surface-base data-[state=active]:font-semibold data-[state=active]:text-text-primary">Yesterday</TabsTrigger>
            <TabsTrigger value="week" className="min-w-0 flex-1 shrink rounded-md px-2 text-[11px] font-medium data-[state=active]:bg-surface-base data-[state=active]:font-semibold data-[state=active]:text-text-primary">This week</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search activities"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 rounded-lg border-border bg-surface-muted pl-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0 px-5 pb-4">
        <div className="h-full overflow-y-auto scrollbar-thin divide-y divide-border">
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
              <div key={activity.id || index} className="flex items-start gap-3 py-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    greenActivityTypes.has(activity.type) ? "text-primary-foreground" : "text-white",
                    activityColors[activity.type],
                  )}
                >
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