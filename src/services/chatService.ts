import api from "@/lib/axios";

export interface ChatUser {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  lastLoginAt?: string | null;
  firebaseUid?: string | null;
  roles?: string[];
}

export interface ConversationParticipant {
  id: string;
  userId: string;
  conversationId: string;
  joinedAt: string;
  lastReadAt: string;
  user: ChatUser;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  editedAt?: string | null;
  createdAt: string;
  sender?: ChatUser;
}

export interface Conversation {
  id: string;
  type: "SUPPLIER_ADMIN" | "USER_SUPPORT";
  title?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages: Message[];
  unreadCount: number;
}

export interface MessagesResult {
  messages: Message[];
  nextCursor: string | null;
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get("/chat/conversations");
  return res.data.data?.conversations || [];
}

export async function getOrCreateConversation(recipientId: string, type?: string): Promise<Conversation> {
  const res = await api.post("/chat/conversations", { recipientId, type });
  return res.data.data.conversation;
}

export async function getMessages(
  conversationId: string,
  cursor?: string,
  limit = 50
): Promise<MessagesResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const res = await api.get(
    `/chat/conversations/${conversationId}/messages?${params.toString()}`
  );
  return res.data.data as MessagesResult;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  attachment?: { url?: string; type?: string }
): Promise<Message> {
  const body: Record<string, string> = { content };
  if (attachment?.url) {
    body.attachmentUrl = attachment.url;
    body.attachmentType = attachment.type || "image";
  }
  const res = await api.post(`/chat/conversations/${conversationId}/messages`, body);
  return res.data.data.message as Message;
}

export async function markConversationAsRead(conversationId: string) {
  const res = await api.patch(`/chat/conversations/${conversationId}/read`);
  return res.data.data;
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await api.get("/chat/conversations/unread-count");
  return res.data.data as { count: number };
}

export async function uploadChatImage(file: File): Promise<{ url: string; type: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/chat/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data as { url: string; type: string };
}

export async function updateMessage(
  conversationId: string,
  messageId: string,
  content: string
): Promise<Message> {
  const res = await api.put(
    `/chat/conversations/${conversationId}/messages/${messageId}`,
    { content }
  );
  return res.data.data.message as Message;
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  await api.delete(`/chat/conversations/${conversationId}/messages/${messageId}`);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await api.delete(`/chat/conversations/${conversationId}`);
}

export async function searchUsers(query: string, role?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (role) params.set("role", role);
  const res = await api.get(`/admin/users/search?${params.toString()}`);
  return res.data.data.users as ChatUser[];
}
