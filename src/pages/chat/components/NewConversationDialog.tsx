import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { searchUsers, type ChatUser } from "@/services/chatService";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface SupplierResult {
  id: string;
  status?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    photoURL?: string;
  };
  businessInfo?: {
    legalBusinessName?: string;
    businessName?: string;
    displayName?: string;
  };
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (recipientId: string, recipientName: string) => void;
  chatType?: "suppliers" | "customers";
}

function Skeleton({ chatType }: { chatType: "suppliers" | "customers" }) {
  const bg = chatType === "suppliers" ? "bg-green-100/60" : "bg-blue-100/60";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={cn("h-10 w-10 animate-pulse rounded-full", bg)} />
      <div className="flex-1 space-y-2">
        <div className={cn("h-3 w-32 animate-pulse rounded", bg)} />
        <div className={cn("h-2.5 w-24 animate-pulse rounded", bg)} />
      </div>
    </div>
  );
}

const accent = (type: "suppliers" | "customers") => ({
  bg50: type === "suppliers" ? "bg-green-50" : "bg-blue-50",
  bg50slash20: type === "suppliers" ? "bg-green-50/20" : "bg-blue-50/20",
  text400: type === "suppliers" ? "text-green-400" : "text-blue-400",
  text600: type === "suppliers" ? "text-green-600" : "text-blue-600",
  hoverText700: type === "suppliers" ? "hover:text-green-700" : "hover:text-blue-700",
  gradient: type === "suppliers" ? "bg-green-500" : "bg-status-approved",
  border: type === "suppliers" ? "focus-visible:border-green-400" : "focus-visible:border-blue-400",
});

export function NewConversationDialog({
  open,
  onOpenChange,
  onSelect,
  chatType = "suppliers",
}: NewConversationDialogProps) {
  const a = accent(chatType);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setFocusedIndex(-1);
    }
  }
  const debounceRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchQuery = query.trim().toLowerCase();

  const isSuppliers = chatType === "suppliers";

  const { data: results = [], isLoading } = useQuery({
    queryKey: isSuppliers
      ? ["admin", "suppliers", "search", searchQuery]
      : ["admin", "customers", "search", searchQuery],
    queryFn: isSuppliers
      ? async () => {
          const params = new URLSearchParams({
            page: "1",
            limit: "50",
            status: "ACTIVE",
          });
          if (searchQuery) params.set("search", searchQuery);
          const res = await api.get(
            `/suppliers/admin/applications?${params.toString()}`
          );
          return (res.data.data?.applications || res.data.applications || []) as SupplierResult[];
        }
      : async () => {
          const users = await searchUsers(searchQuery, "customer");
          return (users as ChatUser[]).filter((u) => !u.roles?.includes('supplier'));
        },
    enabled: open,
  });

  const [prevSearchKey, setPrevSearchKey] = useState(`${searchQuery}|${results.length}`);
  const searchKey = `${searchQuery}|${results.length}`;
  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey);
    setFocusedIndex(-1);
  }

  const getItemName = (item: SupplierResult | ChatUser) => {
    if ("user" in item) {
      return (
        item.user?.name ||
        (item as SupplierResult).businessInfo?.legalBusinessName ||
        (item as SupplierResult).businessInfo?.businessName ||
        (item as SupplierResult).businessInfo?.displayName ||
        item.user?.email ||
        "Unknown"
      );
    }
    return (item as ChatUser).name || (item as ChatUser).email || "Unknown";
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => setQuery(val), 300);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        if (isSuppliers) {
          const supplier = results[focusedIndex] as SupplierResult;
          if (supplier) {
            onSelect(supplier.user?.id || supplier.id, getItemName(supplier));
          }
        } else {
          const user = results[focusedIndex] as ChatUser;
          if (user) {
            onSelect(user.id, user.name || user.email || "Unknown");
          }
        }
      }
    },
    [results, focusedIndex, onSelect, isSuppliers]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-xl">
        <div className="border-b border-border/50 px-5 py-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-bold text-text-primary">
              {isSuppliers ? "New Supplier Conversation" : "New Customer Conversation"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isSuppliers
                ? "Search for a supplier to start messaging"
                : "Search for a customer to start messaging"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-text-tertiary" aria-hidden="true">
            {isSuppliers
              ? "Search for a supplier to start messaging"
              : "Search for a customer to start messaging"}
          </p>
        </div>

        <div className="relative border-b border-border/50 px-4 py-3">
          <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            ref={inputRef}
            placeholder={isSuppliers ? "Search suppliers by name or email..." : "Search customers by name or email..."}
            autoComplete="off"
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className={cn("w-full rounded-lg border border-border/60 py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:bg-surface-base transition-colors", a.bg50slash20, a.border)}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
            {searchQuery
              ? `Results (${results.length})`
              : isSuppliers
                ? "Active suppliers"
                : "Customers"}
          </span>
        </div>

        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto scrollbar-none"
        >
          {isLoading ? (
            <div className="space-y-1 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} chatType={chatType} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              {searchQuery ? (
                <>
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", a.bg50)}>
                    <Search className={cn("h-5 w-5", a.text400)} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-text-secondary">
                    No results found
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Try a different name or email
                  </p>
                  <button
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className={cn("mt-3 text-xs font-medium transition-colors", a.text600, a.hoverText700)}
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", a.bg50)}>
                    <UserPlus className={cn("h-5 w-5", a.text400)} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-text-secondary">
                    {isSuppliers ? "No suppliers available" : "No customers found"}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {isSuppliers
                      ? "Active suppliers will appear here"
                      : "Customers who have signed up will appear here"}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="py-1">
              {results.map((item, idx) => {
                const name = getItemName(item);
                const initial = name.charAt(0).toUpperCase();
                const isFocused = focusedIndex === idx;

                if (isSuppliers) {
                  const supplier = item as SupplierResult;
                  return (
                    <button
                      key={supplier.id}
                      onClick={() => onSelect(supplier.user?.id || supplier.id, name)}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3 text-left transition-all duration-200 focus-visible:outline-none",
                        isFocused && a.bg50
                      )}
                    >
                      <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm", a.gradient)}>
                        <span>{initial}</span>
                        {supplier.user?.photoURL && (
                          <OptimizedImage
                            src={supplier.user.photoURL}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 h-full w-full object-cover"
                            width={40}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                          {supplier.businessInfo?.legalBusinessName && (
                            <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-[1px] text-[10px] font-medium text-blue-600">
                              Business
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          {supplier.user?.email && (
                            <p className="truncate text-xs text-text-tertiary">{supplier.user.email}</p>
                          )}
                          {supplier.status && (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-medium",
                                supplier.status === "ACTIVE" ? a.bg50 + " " + a.text600 : "bg-amber-50 text-amber-600"
                              )}
                            >
                              {supplier.status === "ACTIVE" ? "Active" : supplier.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                }

                const user = item as ChatUser;
                return (
                  <button
                    key={user.id}
                    onClick={() => onSelect(user.id, name)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3 text-left transition-all duration-200 focus-visible:outline-none",
                      isFocused && a.bg50
                    )}
                  >
                    <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm", a.gradient)}>
                      <span>{initial}</span>
                      {user.photoURL && (
                        <OptimizedImage
                          src={user.photoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-cover"
                          width={40}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                      {user.email && (
                        <p className="mt-0.5 truncate text-xs text-text-tertiary">{user.email}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 px-5 py-3">
          <p className="text-[11px] text-text-tertiary text-center">
            {results.length > 0
              ? "Type to filter · ↑↓ to navigate · Enter to select"
              : ""}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}