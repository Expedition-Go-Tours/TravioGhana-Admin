import { useState } from "react";
import { motion } from "framer-motion";
import { cn, timeAgo } from "@/lib/utils";
import { MailOpen, Inbox, Eye, Building2, Headphones } from "lucide-react";
import type { Conversation } from "@/services/chatService";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  loading: boolean;
  chatType?: "suppliers" | "customers" | "expedition";
  typingConversations: Record<string, { userName: string }>;
}

const accent = (type: "suppliers" | "customers") => ({
  bg: type === "suppliers" ? "green" : "blue",
  bg50: type === "suppliers" ? "bg-green-50" : "bg-blue-50",
  bg50slash: type === "suppliers" ? "bg-green-50/70" : "bg-blue-50/70",
  bg100: type === "suppliers" ? "bg-green-100/60" : "bg-blue-100/60",
  text: type === "suppliers" ? "text-green-600" : "text-blue-600",
  text700: type === "suppliers" ? "text-green-700" : "text-blue-700",
  text400: type === "suppliers" ? "text-green-400" : "text-blue-400",
  ring: type === "suppliers" ? "focus-visible:ring-green-400" : "focus-visible:ring-blue-400",
  gradient: type === "suppliers" ? "bg-green-500" : "bg-status-approved",
  badge: type === "suppliers" ? "bg-green-600" : "bg-blue-600",
});

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
  chatType = "suppliers",
  typingConversations,
}: ConversationListProps) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const a = accent(chatType);

  const displayed = tab === "unread"
    ? conversations.filter((c) => c.unreadCount > 0)
    : conversations;

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-sm p-2">
            <div className={cn("h-10 w-10 animate-pulse rounded-full", a.bg100)} />
            <div className="flex-1 space-y-1.5">
              <div className={cn("h-3 w-24 animate-pulse rounded", a.bg100)} />
              <div className={cn("h-2.5 w-32 animate-pulse rounded", a.bg100)} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unreadCount = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2">
        <div className={cn("relative flex rounded-lg p-0.5", a.bg50slash)}>
          <div
            className={cn(
              "absolute inset-y-0.5 z-0 rounded-md bg-surface-base shadow-sm ring-1 ring-black/5 transition-all duration-200 ease-out",
              tab === "all" ? "left-0.5 right-1/2" : "left-1/2 right-0.5"
            )}
          />
          <button
            onClick={() => setTab("all")}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              tab === "all" ? "font-semibold" : "font-medium"
            )}
          >
            <Inbox className={cn(
              "h-4 w-4 transition-colors",
              tab === "all" ? a.text : "text-text-tertiary"
            )} />
            <span className={tab === "all" ? a.text700 : "text-text-secondary"}>
              All
            </span>
          </button>
          <button
            onClick={() => setTab("unread")}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              tab === "unread" ? "font-semibold" : "font-medium"
            )}
          >
            <MailOpen className={cn(
              "h-4 w-4 transition-colors",
              tab === "unread" ? a.text : "text-text-tertiary"
            )} />
            <span className={tab === "unread" ? a.text700 : "text-text-secondary"}>
              Unread
            </span>
            {unreadCount > 0 && (
              <span className={cn("flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none text-white shadow-sm", a.badge)}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl mb-4", a.bg50)}>
              {tab === "unread" ? (
                <Eye className={cn("h-6 w-6", a.text400)} />
              ) : chatType === "suppliers" ? (
                <Building2 className={cn("h-6 w-6", a.text400)} />
              ) : (
                <Headphones className={cn("h-6 w-6", a.text400)} />
              )}
            </div>
            <p className="text-sm font-medium text-text-secondary">
              {tab === "unread"
                ? "No unread messages"
                : chatType === "suppliers"
                  ? "No supplier conversations"
                  : "No customer conversations"}
            </p>
            <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
              {tab === "all"
                ? `Click "New" above to start a conversation with a ${chatType === "suppliers" ? "supplier" : "customer"}`
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {displayed.map((conv) => {
              const otherUser = conv.participants?.find(
                (p) => p.user.roles && !p.user.roles.includes('admin')
              )?.user || conv.participants?.[0]?.user;
              const name = otherUser?.name || otherUser?.email || conv.title || "Unknown";
              const roleLabel = otherUser?.roles?.includes('supplier')
                ? "Supplier"
                : otherUser?.roles?.includes('customer')
                  ? "Customer"
                  : "User";
              const lastMsg = conv.messages?.[0];
              const preview = lastMsg
                ? lastMsg.content.length > 50
                  ? lastMsg.content.slice(0, 50) + "..."
                  : lastMsg.content
                : "No messages yet";

              const formatLastActive = (dateStr?: string | null) => {
                if (!dateStr) return null;
                const diff = Date.now() - new Date(dateStr).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return "Online";
                if (mins < 60) return `Active ${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `Active ${hrs}h ago`;
                const days = Math.floor(hrs / 24);
                return `Active ${days}d ago`;
              };

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none hover:shadow-sm",
                    a.ring,
                    selectedId === conv.id && a.bg50
                  )}
                >
                  <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-sm font-bold text-white", a.gradient)}>
                    <span>{name.charAt(0).toUpperCase()}</span>
                    {otherUser?.photoURL && (
                      <OptimizedImage
                        src={otherUser.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover"
                        width={40}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {name}
                        </span>
                        <span className={cn(
                          "shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-normal",
                          roleLabel === "Supplier"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-purple-50 text-purple-600"
                        )}>
                          {roleLabel}
                        </span>
                      </div>
                      {lastMsg && (
                        <span className="shrink-0 text-[11px] text-text-tertiary">
                          {timeAgo(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {typingConversations[conv.id] ? (
                        <span className={cn("truncate text-xs", a.text)}>
                          <span className="inline-flex items-center gap-1">
                            <span>typing</span>
                            {[0, 1, 2].map((i) => (
                              <motion.span
                                key={i}
                                className={cn("h-1.5 w-1.5 rounded-full", a.badge)}
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                              />
                            ))}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-xs text-text-secondary">
                          {chatType === "suppliers"
                            ? (formatLastActive(otherUser?.lastLoginAt) || preview)
                            : preview}
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className={cn("flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white", a.badge)}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {chatType === "customers" && otherUser?.lastLoginAt && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-text-tertiary">
                          {formatLastActive(otherUser.lastLoginAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}