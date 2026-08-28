import { useState, useRef, useEffect } from "react";
import { Check, CheckCheck, Loader2, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/services/chatService";
import OptimizedImage from "@/components/shared/OptimizedImage";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  status?: MessageStatus;
  showAvatar?: boolean;
  senderAvatar?: string;
  senderName?: string;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onAvatarClick?: (userId: string) => void;
}

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const statusIcon: Record<MessageStatus, React.ReactNode> = {
  sending: <Loader2 className="h-3 w-3 animate-spin" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3 text-[#53bdeb]" />,
};

export function MessageBubble({
  message,
  isOwn,
  status,
  showAvatar = true,
  senderAvatar,
  senderName,
  onEdit,
  onDelete,
  onAvatarClick,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!fullscreenImage) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenImage(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [fullscreenImage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(
        editInputRef.current.value.length,
        editInputRef.current.value.length
      );
    }
  }, [editing]);

  const handleEdit = () => {
    setMenuOpen(false);
    setEditValue(message.content);
    setEditing(true);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    onDelete?.(message.id);
  };

  const handleSaveEdit = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEdit?.(message.id, trimmed);
      setEditing(false);
    } catch {
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditValue(message.content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div className={cn("group flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {isOwn ? (
        <div className="w-8 shrink-0" />
      ) : showAvatar ? (
        <div
          className="relative mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-green-500 text-xs font-bold text-white"
          onClick={() => message.sender?.id && onAvatarClick?.(message.sender.id)}
        >
          <span>{senderName?.charAt(0)?.toUpperCase() || "?"}</span>
          {senderAvatar && (
            <OptimizedImage
              src={senderAvatar}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              width={32}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className={cn("flex max-w-[68%] flex-col min-w-0", isOwn ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            isOwn
              ? "bg-green-600 text-white rounded-[18px] rounded-br-[4px]"
              : "bg-surface-base text-text-primary border border-border/50 rounded-[18px] rounded-bl-[4px]"
          )}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded-lg border border-green-400 bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 scrollbar-none"
                rows={3}
                disabled={saving}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="rounded-full px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editValue.trim()}
                  className="rounded-full bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.attachmentUrl && (
                <div className={cn("-mx-3.5 -mt-2 cursor-pointer border border-black/10 overflow-hidden", message.content ? "rounded-t-[18px] mb-1" : "rounded-[18px]")}>
                  <OptimizedImage
                    src={message.attachmentUrl}
                    alt=""
                    className="max-h-72 w-full object-cover hover:scale-105 transition-transform duration-200"
                    width={600}
                    fit="fill"
                    onClick={() => setFullscreenImage(message.attachmentUrl!)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              {message.content && (
                <span className="whitespace-pre-wrap break-all">{message.content}</span>
              )}
              {message.editedAt && (
                <span className={cn("ml-1 text-[10px]", isOwn ? "text-white/50" : "text-text-tertiary")}>
                  (edited)
                </span>
              )}
              <div
                className={cn(
                  "mt-1 flex items-center gap-1",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    isOwn ? "text-white/70" : "text-text-tertiary"
                  )}
                >
                  {formatMessageTime(message.createdAt)}
                </span>
                {isOwn && status && (
                  <span className="flex">{statusIcon[status]}</span>
                )}
              </div>
            </>
          )}
        </div>

        {isOwn && !editing && (onEdit || onDelete) && (
          <div className="relative mt-0.5" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-green-100 hover:text-green-700"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div
                className={cn(
                  "absolute z-50 min-w-[120px] overflow-hidden rounded-lg border border-border/50 bg-surface-base py-1 shadow-lg",
                  isOwn ? "right-0" : "left-0"
                )}
              >
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-green-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
          <OptimizedImage
            src={fullscreenImage}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            width={1600}
            fit="fill"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
