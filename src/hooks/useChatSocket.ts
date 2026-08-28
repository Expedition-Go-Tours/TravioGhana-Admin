import { useEffect, useCallback } from "react";
import { getAdminSocket } from "@/lib/adminSocket";
import type { Message } from "@/services/chatService";

interface TypingEvent {
  conversationId: string;
  userId: string;
  userName?: string;
  isTyping?: boolean;
}

interface ChatMessageEvent {
  conversationId: string;
  message: Message;
}

interface MarkReadEvent {
  conversationId: string;
  readBy: string;
  readAt: string;
}

interface DeliveredEvent {
  conversationId: string;
  messageIds: string[];
  deliveredTo?: string;
}

export function useChatSocket(conversationId: string | null) {
  const socket = getAdminSocket();

  useEffect(() => {
    if (!conversationId) return;

    const joinRoom = () => {
      socket.emit("chat:join", { conversationId }, (response: { status?: string; message?: string }) => {
        if (response?.status === "error") {
          console.warn("[chat:join] Failed to join conversation:", conversationId, response.message);
        }
      });
    };

    socket.on("connect", joinRoom);
    joinRoom();

    return () => {
      socket.emit("chat:leave", { conversationId });
      socket.off("connect", joinRoom);
    };
  }, [conversationId, socket]);

  const onNewMessage = useCallback(
    (cb: (message: Message, convId: string) => void) => {
      const handler = (data: ChatMessageEvent) => {
        cb(data.message, data.conversationId);
      };
      socket.on("chat:message", handler);
      return () => {
        socket.off("chat:message", handler);
      };
    },
    [socket]
  );

  const onTyping = useCallback(
    (cb: (data: TypingEvent) => void) => {
      socket.on("chat:typing", cb);
      return () => {
        socket.off("chat:typing", cb);
      };
    },
    [socket]
  );

  const onMarkRead = useCallback(
    (cb: (data: MarkReadEvent) => void) => {
      socket.on("chat:mark-read", cb);
      return () => {
        socket.off("chat:mark-read", cb);
      };
    },
    [socket]
  );

  const onDelivered = useCallback(
    (cb: (data: DeliveredEvent) => void) => {
      socket.on("chat:delivered", cb);
      return () => {
        socket.off("chat:delivered", cb);
      };
    },
    [socket]
  );

  const emitTyping = useCallback(
    (convId: string, isTyping: boolean) => {
      socket.emit("chat:typing", { conversationId: convId, isTyping });
    },
    [socket]
  );

  const emitMarkRead = useCallback(
    (convId: string) => {
      socket.emit("chat:mark-read", { conversationId: convId });
    },
    [socket]
  );

  const emitDelivered = useCallback(
    (convId: string, messageIds: string[]) => {
      socket.emit("chat:delivered", {
        conversationId: convId,
        messageIds,
      });
    },
    [socket]
  );

  return { onNewMessage, onTyping, onMarkRead, onDelivered, emitTyping, emitMarkRead, emitDelivered };
}
