import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, PauseCircle, Wallet } from "lucide-react";
import api from "@/lib/axios";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/**
 * Row expansion for the payout schedules table.
 *
 * The cell above this shows one number — "Eligible now" — and a number on its
 * own does not tell a finance officer anything. This answers the three
 * questions that actually decide whether a run happens:
 *
 *   1. What is in the pot?      the booking line items, oldest first
 *   2. Can it be paid?          destination verified, and to where
 *   3. Will it fire?            the first thing that would make the run skip
 *
 * The line items are fetched lazily, only when a row with money is opened
 * (38 of 40 suppliers currently have none), and they come from the same
 * `eligibleBookingsWhere` predicate as the cell above — so the total here can
 * never disagree with the total there.
 */

export interface PayoutReadiness {
  code: "NO_METHOD" | "NOTHING_ELIGIBLE" | "BELOW_MINIMUM" | "SCHEDULER_PAUSED" | "READY";
  label: string;
  detail: string;
  kind: "ready" | "blocked" | "idle";
}

export interface EligibleBooking {
  id: string;
  bookingNumber: string;
  tourTitle: string | null;
  travelDate: string | null;
  supplierPayout: number;
  currency: string;
  status: string;
  paymentStatus: string;
  clearedAt: string;
  /** Null when the supplier has no cadence to compare against. */
  inPeriod: boolean | null;
}

interface EligibleBookingsPayload {
  bookings?: EligibleBooking[];
  period?: { start: string; end: string; label: string } | null;
  straddlesPeriod?: boolean;
}

/** Paused is amber rather than red: it is a switch, not a fault in this row. */
function toneFor(readiness: PayoutReadiness) {
  if (readiness.code === "SCHEDULER_PAUSED") {
    return { Icon: PauseCircle, tone: "text-amber-600 dark:text-amber-400", box: "border-amber-500/30 bg-amber-500/10" };
  }
  if (readiness.kind === "ready") {
    return { Icon: CheckCircle2, tone: "text-status-active-text", box: "border-status-active/30 bg-status-active/10" };
  }
  if (readiness.kind === "blocked") {
    return { Icon: AlertTriangle, tone: "text-status-rejected-text", box: "border-status-rejected/30 bg-status-rejected/10" };
  }
  return { Icon: Clock, tone: "text-text-tertiary", box: "border-border/60 bg-surface-muted/40" };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{children}</p>
  );
}

/** Muted bars with a fixed height — the expansion must not jump as it loads. */
function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0">
          <div className="h-3.5 w-32 animate-pulse rounded bg-surface-muted" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-surface-muted" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * Stated structurally rather than as a second `ScheduleRow` interface: this is
 * the whole contract this component reads, so the caller's richer row type
 * satisfies it without a copy of its own to keep in step. Rename a field in
 * here and the call site fails to compile instead of rendering blank.
 */
export function SupplierPayoutDetail({ row }: {
  row: {
    supplierId: string;
    eligibleBalance: { amount: number; bookingCount: number; currency: string };
    hasVerifiedMethod: boolean;
    readiness: PayoutReadiness;
    plan: { scheduleLabel?: string | null; nextRunAt?: string | null; nextRunPeriodLabel?: string | null };
  };
}) {
  const navigate = useNavigate();
  const balance = row.eligibleBalance || { amount: 0, bookingCount: 0, currency: "USD" };
  const readiness = row.readiness;
  const { Icon, tone, box } = toneFor(readiness);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<EligibleBookingsPayload>({
    queryKey: ["admin", "supplier-eligible-bookings", row.supplierId],
    queryFn: () =>
      api
        .get(`/admin/finance/payout-schedules/${row.supplierId}/eligible-bookings`)
        .then((r) => r.data?.data || {}),
    // An empty pot needs no line items — the readiness reason below already
    // says why, and 38 of these suppliers are in that state.
    enabled: balance.bookingCount > 0,
    staleTime: 30_000,
  });

  const bookings = data?.bookings || [];
  const straddles = data?.straddlesPeriod === true;
  const periodLabel = data?.period?.label || row.plan?.nextRunPeriodLabel || null;
  const currency = balance.currency || bookings[0]?.currency || "USD";

  return (
    <div className="px-5 py-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left — what is actually in the pot. Weighted the wider of the two:
            four columns of booking detail have to fit without a horizontal
            scrollbar at desktop widths. Below `lg` it stacks, and the table
            scrolls within itself instead of pushing the page. */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <SectionLabel>
              {periodLabel ? `In the pot for the ${periodLabel} run` : "In the pot"}
            </SectionLabel>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {formatCurrency(balance.amount, currency)} · {balance.bookingCount} booking
              {balance.bookingCount === 1 ? "" : "s"}
            </p>
          </div>

          {balance.bookingCount === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-surface-muted/30 px-4 py-5 text-center">
              <Wallet className="mx-auto h-5 w-5 text-text-tertiary" aria-hidden />
              <p className="mt-2 text-sm font-medium text-text-secondary">Nothing to show yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-tertiary">
                This supplier has no bookings in a payable state. {readiness.detail}
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-status-rejected/30 bg-status-rejected/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-status-rejected-text" aria-hidden />
              <p className="text-sm text-status-rejected-text">Could not load the bookings behind this figure.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="ml-auto rounded-md px-2.5 py-1 text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Bookings ready for this supplier&apos;s next payout run, with travel date and supplier payout
                  </caption>
                  <thead>
                    <tr className="sticky top-0 border-b border-border/60 bg-surface-muted/95 text-xs backdrop-blur-md">
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">Booking</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">Tour</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">Travel</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
                        <span className="sr-only">Supplier payout</span>
                        <span aria-hidden>Payout</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <span className="font-mono text-xs text-text-primary">{b.bookingNumber}</span>
                        </th>
                        <td className="max-w-[14rem] px-3 py-2 text-text-secondary">
                          <span className="block truncate" title={b.tourTitle || ""}>
                            {b.tourTitle || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-text-secondary">
                          {b.travelDate ? formatDate(b.travelDate) : "—"}
                          {b.inPeriod === false && (
                            <span
                              className="ml-1.5 rounded bg-surface-muted px-1 py-0.5 text-[10px] font-semibold text-text-tertiary"
                              title="Travelled before the window this run is labelled with — still payable, it simply cleared late."
                            >
                              outside
                              <span className="sr-only"> — travel date is outside the labelled window</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-text-primary">
                          {formatCurrency(b.supplierPayout, b.currency || currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="sticky bottom-0 border-t-2 border-border bg-surface-muted/95 backdrop-blur-md">
                      <th scope="row" colSpan={3} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Total ready
                      </th>
                      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-primary">
                        {formatCurrency(balance.amount, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {straddles && (
            <p className="text-xs leading-relaxed text-text-tertiary">
              {bookings.filter((b) => b.inPeriod === false).length} of these travelled before the{" "}
              {periodLabel || "next"} window. That is expected: the figure is everything that has cleared so far,
              while the window names when the run happens. Late-clearing bookings ride along with the run.
            </p>
          )}
        </div>

        {/* Right — whether it can be paid, and why it will or won't fire */}
        <div className="min-w-0 space-y-4">
          <div>
            <SectionLabel>Will this run fire</SectionLabel>
            <div className={cn("mt-1.5 rounded-lg border p-3", box)}>
              <div className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{readiness.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{readiness.detail}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Destination</SectionLabel>
            <div className="mt-1.5 rounded-lg border border-border/60 bg-surface-muted/40 p-3">
              {row.hasVerifiedMethod ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-status-active-text">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Verified payout method on file
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-rejected-text" aria-hidden />
                  <p className="text-sm text-status-rejected-text">
                    No verified payout method — the money has nowhere to go.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/admin/payouts?tab=methods")}
                className="mt-2 rounded-md px-2 py-1 -ml-2 text-sm font-medium text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Manage payout methods
              </button>
            </div>
          </div>

          <div>
            <SectionLabel>Cadence</SectionLabel>
            <dl className="mt-1.5 space-y-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Schedule</dt>
                <dd className="text-right font-medium text-text-primary">{row.plan?.scheduleLabel || "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Next run</dt>
                <dd className="flex items-center gap-1.5 text-right font-medium tabular-nums text-text-primary">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
                  {row.plan?.nextRunAt ? formatDate(row.plan.nextRunAt) : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
              Read-only: a supplier changes their own cadence in Settings → Payouts, and this list shows what they
              chose.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
