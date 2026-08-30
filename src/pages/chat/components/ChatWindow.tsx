import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, Paperclip, ChevronRight, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MessageBubble, type MessageStatus } from "./MessageBubble";
import { useChatSocket } from "@/hooks/useChatSocket";
import { uploadChatImage } from "@/services/chatService";
import type { Message, Conversation } from "@/services/chatService";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  messageStatuses: Record<string, MessageStatus>;
  onSendMessage: (content: string, attachment?: { url: string; type: string }) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  sending: boolean;
  currentUserId: string | null;
  onViewProfile?: (userId: string) => void;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onDeleteConversation?: () => Promise<void>;
  chatType?: "suppliers" | "customers" | "expedition";
  onBack?: () => void;
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function isNewDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}

function formatLastSeen(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "online";
  if (diffMin < 5) return "online";

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return `last seen today at ${time}`;
  if (msgDate.getTime() === yesterday.getTime()) return `last seen yesterday at ${time}`;

  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return `last seen ${date} at ${time}`;
}

const accent = (type: "suppliers" | "customers") => ({
  bg: type === "suppliers" ? "green" : "blue",
  bg30: type === "suppliers" ? "bg-green-50/30" : "bg-blue-50/30",
  bg50: type === "suppliers" ? "bg-green-50" : "bg-blue-50",
  text: type === "suppliers" ? "text-green-600" : "text-blue-600",
  text400: type === "suppliers" ? "text-green-400" : "text-blue-400",
  text700: type === "suppliers" ? "text-green-700" : "text-blue-700",
  border: type === "suppliers" ? "focus-visible:border-green-400" : "focus-visible:border-blue-400",
  gradient: type === "suppliers" ? "bg-green-500" : "bg-status-approved",
  hover: type === "suppliers" ? "hover:bg-green-50" : "hover:bg-blue-50",
  hoverText: type === "suppliers" ? "hover:text-green-600" : "hover:text-blue-600",
  hoverText700: type === "suppliers" ? "hover:text-green-700" : "hover:text-blue-700",
  button: type === "suppliers" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700",
  scrollBg: type === "suppliers" ? "hover:bg-green-50" : "hover:bg-blue-50",
  loadMore: type === "suppliers" ? "hover:bg-green-50 text-green-600" : "hover:bg-blue-50 text-blue-600",
  badge: type === "suppliers" ? "bg-green-600" : "bg-blue-600",
});

export function ChatWindow({
  conversation,
  messages,
  messageStatuses,
  onSendMessage,
  onLoadMore,
  hasMore,
  loadingMore,
  sending,
  onViewProfile,
  onEditMessage,
  onDeleteMessage,
  onDeleteConversation,
  chatType = "suppliers",
  onBack,
}: ChatWindowProps) {
  const a = accent(chatType);
  const [input, setInput] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | undefined>(undefined);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCountRef = useRef(messages.length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { onTyping, emitTyping } = useChatSocket(conversation?.id || null);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom()) {
      const el = messagesContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [isNearBottom]);

  const stopTypingSignal = useCallback(() => {
    if (conversation?.id) {
      emitTyping(conversation.id, false);
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
      typingStopRef.current = null;
    }
  }, [conversation, emitTyping]);

  useEffect(() => {
    const unsub = onTyping((data) => {
      if (data.conversationId === conversation?.id) {
        if (data.isTyping === false) {
          setTypingUser(null);
          return;
        }
        setTypingUser(data.userName || "Someone");
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setTypingUser(null), 3000);
      }
    });
    return () => {
      unsub();
      clearTimeout(typingTimeoutRef.current);
    };
  }, [conversation?.id, onTyping]);

  useEffect(() => {
    return () => {
      stopTypingSignal();
    };
  }, [conversation?.id, stopTypingSignal]);

  useEffect(() => {
    if (typingUser) {
      scrollToBottom(true);
    }
  }, [typingUser, scrollToBottom]);

  const prevConvIdRef = useRef<string | null>(null);
  const pendingScrollRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversation?.id && prevConvIdRef.current !== conversation?.id) {
      prevConvIdRef.current = conversation?.id;
      pendingScrollRef.current = conversation?.id;
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (pendingScrollRef.current === conversation?.id && messages.length > 0) {
      pendingScrollRef.current = null;
      requestAnimationFrame(() => scrollToBottom(true));
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, conversation?.id, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(!isNearBottom());

    if (el.scrollTop < 50 && hasMore && !loadingMore && onLoadMore) {
      const prevHeight = el.scrollHeight;
      onLoadMore();
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }, [hasMore, loadingMore, onLoadMore, isNearBottom]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    stopTypingSignal();
    await onSendMessage(trimmed);
    requestAnimationFrame(() => scrollToBottom(true));
  }, [input, sending, onSendMessage, scrollToBottom, stopTypingSignal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    if (conversation?.id) {
      if (!typingIntervalRef.current) {
        emitTyping(conversation.id, true);
        typingIntervalRef.current = setInterval(() => {
          if (conversation?.id) emitTyping(conversation.id, true);
        }, 2000);
      }
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      typingStopRef.current = setTimeout(() => {
        stopTypingSignal();
      }, 1500);
    }
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation?.id) return;
    try {
      const { url, type } = await uploadChatImage(file);
      await onSendMessage("", { url, type });
    } catch {
      toast.error("Failed to upload image");
    }
    e.target.value = "";
  }, [conversation?.id, onSendMessage]);

  const otherParticipant = conversation?.participants?.find(
    (p) => p.user.roles && !p.user.roles.includes('admin') && !p.user.roles.includes('expedition')
  )?.user || conversation?.participants?.[0]?.user;
  const otherParticipantId = conversation?.participants?.find(
    (p) => p.user.roles && !p.user.roles.includes('admin') && !p.user.roles.includes('expedition')
  )?.userId || conversation?.participants?.[0]?.userId;
  const headerName =
    otherParticipant?.name ||
    otherParticipant?.email ||
    conversation?.title ||
    "Chat";

  if (!conversation) {
    return (
      <div className={cn("flex flex-1 w-full flex-col items-center justify-center text-center", a.bg30)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-base shadow-sm">
          <Send className={cn("h-6 w-6", a.text400)} />
        </div>
        <p className="mt-4 text-sm font-medium text-text-secondary">
          Select a conversation
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Choose a conversation from the left to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div
        className="group flex items-center gap-1 border-b border-border/50 bg-surface-base px-5 py-3"
      >
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary lg:hidden"
            title="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div
          className="flex cursor-pointer items-center gap-3 flex-1 min-w-0"
          onClick={() => otherParticipant?.id && onViewProfile?.(otherParticipant.id)}
        >
          <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm", a.gradient)}>
            <span>{headerName.charAt(0).toUpperCase()}</span>
            {otherParticipant?.photoURL && (
              <OptimizedImage
                src={otherParticipant.photoURL}
                alt=""
                width={36}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-text-primary">
                {headerName}
              </p>
              <span className={cn(
                "shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-normal",
                otherParticipant?.roles?.includes('supplier')
                  ? "bg-blue-50 text-blue-600"
                  : "bg-purple-50 text-purple-600"
              )}>
                {otherParticipant?.roles?.includes('supplier')
                  ? "Supplier"
                  : otherParticipant?.roles?.includes('customer')
                    ? "Customer"
                    : "User"}
              </span>
            </div>
            <p className="text-xs text-text-tertiary">{formatLastSeen(otherParticipant?.lastLoginAt)}</p>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-text-tertiary transition-all duration-200 group-hover:translate-x-0.5", chatType === "suppliers" ? "group-hover:text-green-600" : "group-hover:text-blue-600")} />
        </div>
        {onDeleteConversation && (
          <button
            onClick={async () => {
              if (window.confirm("Delete this entire conversation? This cannot be undone.")) {
                await onDeleteConversation();
              }
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-all hover:bg-red-50 hover:text-red-500"
            title="Delete conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={cn("flex-1 overflow-y-auto min-h-0 scrollbar-none", a.bg30)}
      >
        <div className="px-4 py-3">
          {hasMore && (
            <div className="mb-4 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className={cn("rounded-full bg-surface-base px-4 py-1.5 text-xs shadow-sm disabled:opacity-50 transition-colors", a.loadMore)}
              >
                {loadingMore ? "Loading..." : "Load older messages"}
              </button>
            </div>
          )}

          <div className="space-y-1">
              {messages.map((msg, idx) => {
              const isOwn = otherParticipantId ? msg.senderId !== otherParticipantId : true;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDateSep = prevMsg && isNewDay(prevMsg.createdAt, msg.createdAt);
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId || isNewDay(prevMsg.createdAt, msg.createdAt);

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 border-t border-border/40" />
                      <span className="shrink-0 text-[11px] font-medium text-text-tertiary">
                        {formatDateSeparator(msg.createdAt)}
                      </span>
                      <div className="flex-1 border-t border-border/40" />
                    </div>
                  )}
                  {idx === 0 && (
                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 border-t border-border/40" />
                      <span className="shrink-0 text-[11px] font-medium text-text-tertiary">
                        {formatDateSeparator(msg.createdAt)}
                      </span>
                      <div className="flex-1 border-t border-border/40" />
                    </div>
                  )}
                  <div className="py-0.5">
                    <MessageBubble
                      message={msg}
                      isOwn={isOwn}
                      status={isOwn ? messageStatuses[msg.id] : undefined}
                      showAvatar={showAvatar && !isOwn}
                      senderAvatar={isOwn ? undefined : (msg.sender?.photoURL || otherParticipant?.photoURL)}
                      senderName={isOwn ? "Admin" : headerName}
                      onEdit={isOwn ? onEditMessage : undefined}
                      onDelete={onDeleteMessage}
                      onAvatarClick={onViewProfile}
                    />
                  </div>
                </div>
              );
            })}
            {typingUser && (
              <div className="flex items-start gap-2 py-0.5">
                <div className={cn("relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-bold text-white", a.gradient)}>
                  <span>{headerName.charAt(0).toUpperCase()}</span>
                  {otherParticipant?.photoURL && (
                    <OptimizedImage src={otherParticipant.photoURL} alt="" width={32} className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
                <div className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface-base px-4 py-3 shadow-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className={cn("h-2 w-2 rounded-full", a.badge)}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom(true)}
            className={cn("absolute bottom-20 right-8 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-base shadow-lg border border-border/50 transition-colors", a.scrollBg)}
          >
            <ChevronDown className="h-4 w-4 text-text-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="border-t border-border/50 bg-surface-base px-4 py-3">
        <div className="flex items-end gap-2">
          <button
            onClick={handleAttachmentClick}
            className={cn("flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors", a.hoverText, a.hover)}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={sending}
              className={cn("w-full resize-none rounded-2xl border border-border/70 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-surface-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 scrollbar-none", a.bg30, a.border)}
              style={{ maxHeight: "120px" }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn("flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md", a.button)}
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
