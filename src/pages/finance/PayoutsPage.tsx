import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { PayoutsPaymentsTab } from "./components/PayoutsPaymentsTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { PayoutsListTab } from "./components/PayoutsListTab";
import { PayoutsMethodsTab } from "./components/PayoutsMethodsTab";
import { PayoutSchedulesTab } from "./components/PayoutSchedulesTab";
import { PayoutRequestsTab } from "./components/PayoutRequestsTab";
import { DisputesQueueTab } from "./components/DisputesQueueTab";
import { CustomerRefundClaimsTab } from "./components/CustomerRefundClaimsTab";

type PayoutTab =
  | "payments"
  | "invoices"
  | "requests"
  | "schedules"
  | "payouts"
  | "disputes"
  | "claims"
  | "methods";

const TABS: { key: PayoutTab; label: string; description: string }[] = [
  { key: "payments", label: "Overview", description: "Cash position, queues, and payout activity" },
  { key: "requests", label: "Payout requests", description: "Review and release supplier withdrawal requests" },
  { key: "invoices", label: "Invoices", description: "Approve and settle supplier invoices" },
  { key: "schedules", label: "Schedules", description: "Automatic payout cadences by supplier" },
  { key: "payouts", label: "Payout register", description: "Every payout sent, in one ledger" },
  { key: "disputes", label: "Refund requests", description: "Supplier disputes and refund decisions" },
  { key: "claims", label: "Customer claims", description: "Refund claims raised by travelers" },
  { key: "methods", label: "Supplier methods", description: "Bank, mobile money, and PayPal destinations" },
];

const VALID_TABS = new Set<PayoutTab>(TABS.map((tab) => tab.key));

export default function PayoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusOverride, setStatusOverride] = useState<string | undefined>(undefined);

  const requested = searchParams.get("tab") as PayoutTab | null;
  const tab: PayoutTab = requested && VALID_TABS.has(requested) ? requested : "payments";
  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  const { data: summary } = useQuery({
    queryKey: ["admin", "payout-summary"],
    queryFn: () => api.get("/payouts/admin/summary").then((r) => r.data),
    staleTime: 60_000,
  });

  const awaitingCount = summary?.data?.requests?.awaitingApproval?.count ?? 0;
  const transferCount = summary?.data?.requests?.approvedAwaitingTransfer?.count ?? 0;
  const requestBadge = awaitingCount + transferCount;

  const setTab = (next: PayoutTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "payments") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
    setStatusOverride(undefined);
  };

  const openRequests = () => setTab("requests");

  const openRegister = (status?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "payouts");
    setSearchParams(params, { replace: true });
    setStatusOverride(status);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        subtitle="Approve withdrawals, settle invoices, and keep supplier balances moving."
      />

      <div className="sticky -top-4 z-20 -mx-1 border-b border-border bg-surface-muted px-1 md:-top-6 lg:-top-8">
        <nav aria-label="Payout sections" className="scrollbar-none flex gap-5 overflow-x-auto sm:gap-6">
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                title={item.description}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(item.key)}
                className={cn(
                  "relative -mb-px flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 text-[13px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted",
                  active
                    ? "border-primary font-semibold text-text-primary"
                    : "border-transparent font-medium text-text-tertiary hover:text-text-primary",
                )}
              >
                {item.label}
                {item.key === "requests" && requestBadge > 0 && (
                  <span
                    className={cn(
                      "tnum inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                      active ? "bg-primary/10 text-primary" : "bg-surface-base text-text-tertiary ring-1 ring-border",
                    )}
                  >
                    {requestBadge > 99 ? "99+" : requestBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div role="region" aria-label={activeTab.label}>
        {tab === "payments" && (
          <PayoutsPaymentsTab onSwitchToRequests={openRequests} onSwitchToList={openRegister} />
        )}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "requests" && <PayoutRequestsTab />}
        {tab === "schedules" && <PayoutSchedulesTab />}
        {tab === "payouts" && (
          <PayoutsListTab initialStatus={statusOverride} onStatusChange={setStatusOverride} />
        )}
        {tab === "disputes" && <DisputesQueueTab />}
        {tab === "claims" && <CustomerRefundClaimsTab />}
        {tab === "methods" && <PayoutsMethodsTab />}
      </div>
    </div>
  );
}
