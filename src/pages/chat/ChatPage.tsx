import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionError } from "@/components/shared/SectionError";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";
import { NewConversationDialog } from "./components/NewConversationDialog";
import { useChatSocket } from "@/hooks/useChatSocket";
import { getAdminSocket } from "@/lib/adminSocket";
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
  getOrCreateConversation,
  updateMessage,
  deleteMessage,
  deleteConversation,
  type Conversation,
  type Message,
} from "@/services/chatService";
import type { MessageStatus } from "./components/MessageBubble";

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const type = (location.pathname.endsWith('/suppliers') ? 'suppliers' : 'customers') as 'suppliers' | 'customers';
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [currentUserId] = useState<string | null>(() => localStorage.getItem("adminRoleId"));
  const selectedIdRef = useRef<string | null>(null);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectByNotificationRef = useRef<string | null>(null);
  const conversationType = type === "suppliers" ? "SUPPLIER_ADMIN" : "USER_SUPPORT" as const;
  const [typingConversations, setTypingConversations] = useState<Record<string, { userName: string }>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const TYPING_TIMEOUT_MS = 5000;

  useEffect(() => {
    const socket = getAdminSocket();
    const clearTypingTimeout = (convId: string) => {
      if (typingTimeoutsRef.current[convId]) {
        clearTimeout(typingTimeoutsRef.current[convId]);
        delete typingTimeoutsRef.current[convId];
      }
    };
    const handler = (data: { conversationId: string; isTyping: boolean; userName?: string }) => {
      setTypingConversations((prev) => {
        if (data.isTyping) {
          clearTypingTimeout(data.conversationId);
          typingTimeoutsRef.current[data.conversationId] = setTimeout(() => {
            setTypingConversations((prev) => {
              const next = { ...prev };
              delete next[data.conversationId];
              return next;
            });
          }, TYPING_TIMEOUT_MS);
          if (prev[data.conversationId]?.userName === (data.userName || "Someone")) return prev;
          return { ...prev, [data.conversationId]: { userName: data.userName || "Someone" } };
        }
        clearTypingTimeout(data.conversationId);
        if (!prev[data.conversationId]) return prev;
        const next = { ...prev };
        delete next[data.conversationId];
        return next;
      });
    };
    socket.on("chat:typing", handler);
    return () => {
      socket.off("chat:typing", handler);
      for (const convId of Object.keys(typingTimeoutsRef.current)) {
        clearTimeout(typingTimeoutsRef.current[convId]);
      }
      typingTimeoutsRef.current = {};
    };
  }, []);

  const invalidateConvs = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    }, 500);
  }, [queryClient]);

  useEffect(() => {
    const convId = (location.state as { conversationId?: string })?.conversationId;
    if (convId) {
      selectByNotificationRef.current = convId;
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const { onNewMessage, onMarkRead, onDelivered, emitDelivered } = useChatSocket(selectedConv?.id || null);

  const {
    data: allConversations = [],
    isLoading: convsLoading,
    isError: convsError,
    refetch: refetchConvs,
  } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: getConversations,
  });

  const conversations = allConversations.filter((c: Conversation) => {
    if (type === "suppliers") return c.type === "SUPPLIER_ADMIN";
    return c.type === "USER_SUPPORT";
  });

  useEffect(() => {
    const convId = selectByNotificationRef.current;
    if (convId && allConversations.length > 0) {
      const conv = conversations.find((c: Conversation) => c.id === convId)
        || allConversations.find((c: Conversation) => c.id === convId);
      if (conv) {
        selectByNotificationRef.current = null;
        setSelectedConv(conv);
      }
    }
  }, [conversations, allConversations]);

  const sortMessages = (msgs: Message[]) =>
    [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  useEffect(() => {
    if (selectedConv) {
      selectedIdRef.current = selectedConv.id;
      getMessages(selectedConv.id).then((result) => {
        setMessages(sortMessages(result.messages || []));
        setHasMore(!!result.nextCursor);
        const statuses: Record<string, MessageStatus> = {};
        const otherParticipant = selectedConv.participants?.find(
          (p) => p.user.roles && !p.user.roles.includes('admin')
        );
        const lastReadAt = otherParticipant?.lastReadAt ? new Date(otherParticipant.lastReadAt).getTime() : 0;
        for (const msg of result.messages || []) {
          statuses[msg.id] = new Date(msg.createdAt).getTime() <= lastReadAt ? "read" : "sent";
        }
        setMessageStatuses(statuses);
      });
      markConversationAsRead(selectedConv.id).then(() => {
        invalidateConvs();
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      }).catch(() => {});
    }
  }, [selectedConv, queryClient, invalidateConvs]);

  useEffect(() => {
    const unsubMsg = onNewMessage((message, convId) => {
      if (convId === selectedIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          emitDelivered(convId, [message.id]);
          return sortMessages([...prev, message]);
        });
        setMessageStatuses((prev) => ({ ...prev, [message.id]: "sent" }));
        markConversationAsRead(convId).then(() => {
          queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
        }).catch(() => {});
      }
      invalidateConvs();
    });
    return unsubMsg;
  }, [onNewMessage, invalidateConvs, emitDelivered, queryClient]);

  useEffect(() => {
    const unsubRead = onMarkRead(({ conversationId }) => {
      if (conversationId === selectedIdRef.current) {
        setMessageStatuses((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(next)) {
            if (next[id] === "sent" || next[id] === "delivered") {
              next[id] = "read";
            }
          }
          return next;
        });
      }
    });
    return unsubRead;
  }, [onMarkRead]);

  useEffect(() => {
    const unsubDelivered = onDelivered(({ conversationId, messageIds }) => {
      if (conversationId === selectedIdRef.current) {
        setMessageStatuses((prev) => {
          const next = { ...prev };
          for (const id of messageIds) {
            if (next[id] === "sent") {
              next[id] = "delivered";
            }
          }
          return next;
        });
      }
    });
    return unsubDelivered;
  }, [onDelivered]);

  const handleSelect = useCallback((conv: Conversation) => {
    setSelectedConv(conv);
    setMessageStatuses({});
  }, []);

  const handleSend = useCallback(
    async (content: string, attachment?: { url: string; type: string }) => {
      if (!selectedConv) return;
      setSending(true);
      const tempId = `temp-${Date.now()}`;
      setMessageStatuses((prev) => ({ ...prev, [tempId]: "sending" }));
      try {
        const msg = await sendMessage(selectedConv.id, content, attachment);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return sortMessages([...prev, msg]);
        });
        setMessageStatuses((prev) => {
          const next = { ...prev };
          delete next[tempId];
          next[msg.id] = "sent";
          return next;
        });
        invalidateConvs();
      } catch {
        toast.error("Failed to send message");
        setMessageStatuses((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      } finally {
        setSending(false);
      }
    },
    [selectedConv, invalidateConvs]
  );

  const handleLoadMore = useCallback(async () => {
    if (!selectedConv || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const oldestDate = messages[0]?.createdAt;
      if (oldestDate) {
        const result = await getMessages(selectedConv.id, oldestDate);
        setMessages((prev) => sortMessages([...(result.messages || []), ...prev]));
        setHasMore(!!result.nextCursor);
        const otherParticipant = selectedConv?.participants?.find(
          (p) => p.user.roles && !p.user.roles.includes('admin')
        );
        const lastReadAt = otherParticipant?.lastReadAt ? new Date(otherParticipant.lastReadAt).getTime() : 0;
        const statuses: Record<string, MessageStatus> = {};
        for (const msg of result.messages || []) {
          statuses[msg.id] = new Date(msg.createdAt).getTime() <= lastReadAt ? "read" : "sent";
        }
        setMessageStatuses((prev) => ({ ...prev, ...statuses }));
      }
    } catch {
      toast.error("Failed to load older messages");
    } finally {
      setLoadingMore(false);
    }
  }, [selectedConv, messages, loadingMore, hasMore]);

  const handleNewConversation = useCallback(
    async (recipientId: string) => {
      try {
        const conv = await getOrCreateConversation(recipientId, conversationType);
        invalidateConvs();
        setSelectedConv(conv);
        setNewDialogOpen(false);
      } catch {
        toast.error("Failed to start conversation");
      }
    },
    [invalidateConvs, conversationType]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!selectedConv) return;
      const updated = await updateMessage(selectedConv.id, messageId, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m))
      );
    },
    [selectedConv]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!selectedConv) return;
      await deleteMessage(selectedConv.id, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setMessageStatuses((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      invalidateConvs();
    },
    [selectedConv, invalidateConvs]
  );

  const handleDeleteConversation = useCallback(async () => {
    if (!selectedConv) return;
    await deleteConversation(selectedConv.id);
    setSelectedConv(null);
    setMessages([]);
    setMessageStatuses({});
    invalidateConvs();
    toast.success("Conversation deleted");
  }, [selectedConv, invalidateConvs]);

  const handleViewProfile = useCallback(
    (userId: string) => {
      if (type === "suppliers") {
        navigate(`/admin/suppliers/${userId}`);
      } else {
        toast.info("Customer profile coming soon");
      }
    },
    [navigate, type]
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn(
        "flex flex-col border-r border-border/50 bg-surface-base transition-all duration-300 overflow-hidden shrink-0",
        selectedConv ? "w-0 lg:w-[380px]" : "w-full lg:w-[380px]"
      )}>
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <h1 className="text-base font-bold text-text-primary">
            {type === "suppliers" ? "Supplier Messages" : "Customer Support"}
          </h1>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNewDialogOpen(true)}
            className="gap-1.5 rounded-full text-green-600 hover:text-green-700 hover:bg-green-50 px-3"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {convsError ? (
            <SectionError message="Failed to load conversations" onRetry={refetchConvs} />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedConv?.id || null}
              onSelect={handleSelect}
              loading={convsLoading}
              chatType={type}
              typingConversations={typingConversations}
            />
          )}
        </div>
      </div>

      <div className={cn("relative flex flex-col min-h-0", selectedConv ? "flex-1" : "w-0 overflow-hidden lg:flex-1 lg:overflow-visible")}>
            <ChatWindow
              conversation={selectedConv}
              messages={messages}
              messageStatuses={messageStatuses}
              onSendMessage={handleSend}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loadingMore={loadingMore}
              sending={sending}
              currentUserId={currentUserId}
              onViewProfile={handleViewProfile}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onDeleteConversation={handleDeleteConversation}
              chatType={type}
              onBack={() => setSelectedConv(null)}
            />
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSelect={(recipientId) => handleNewConversation(recipientId)}
        chatType={type}
      />
    </div>
  );
}
