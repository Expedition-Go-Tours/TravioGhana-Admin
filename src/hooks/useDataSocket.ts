import { useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { getAdminSocket } from "@/lib/adminSocket";

const MODEL_QUERY_MAP: Record<string, string[]> = {
  Tour: [
    "tour-detail",
    "tours",
    "tour-review",
  ],
  User: [
    "supplier",
    "suppliers",
  ],
  SupplierProfile: [
    "supplier",
    "suppliers",
  ],
  Booking: [
    "bookings",
  ],
  Payout: [
    "payouts",
    "payout-summary",
  ],
  PayoutMethod: [
    "payout-methods",
  ],
  Review: [
    "reviews",
    "reviews-pending-count",
  ],
  AdminNotification: [],
};

export function useDataSocket(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const socket = getAdminSocket();

    const handleDataChange = (event: { model: string; action: string; recordId: string }) => {
      const prefixes = MODEL_QUERY_MAP[event.model];
      if (!prefixes || prefixes.length === 0) return;

      prefixes.forEach((prefix) => {
        queryClient.invalidateQueries({ queryKey: ["admin", prefix] });
      });
    };

    socket.on("data-change", handleDataChange);
    return () => {
      socket.off("data-change", handleDataChange);
    };
  }, [enabled]);
}
