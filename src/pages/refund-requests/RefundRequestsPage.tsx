import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, Wallet, X } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  approveRefundRequest,
  getRefundRequest,
  listRefundRequests,
  rejectRefundRequest,
} from "@/services/refundRequestService";

const TABS: Array<{ key: string; label: string }> = [
  { key: "PENDING_APPROVAL", label: "Pending" },
  { key: "COMPLETED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "WITHDRAWN", label: "Withdrawn" },
  { key: "ALL", label: "All" },
];

/** The server's message when it sent one; a calm fallback otherwise. */
function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

function money(value: number | null | undefined, currency = "USD") {
  return formatCurrency(Number(value || 0), currency);
}

/**
 * Supplier refund requests.
 *
 * The supplier files the request; this queue is where it becomes money. The
 * decision panel shows the live figures — recomputed against the booking, not
 * the snapshot filed days earlier — plus the supplier's balance before and
 * after, because the charge lands on it.
 */
export default function RefundRequestsPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const canDecide = can("payouts.approve");

  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin", "refund-requests", status],
    queryFn: () => listRefundRequests({ status, limit: 50 }),
    refetchInterval: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "refund-requests", "detail", openId],
    queryFn: () => getRefundRequest(openId as string),
    enabled: !!openId,
  });

  const close = () => {
    setOpenId(null);
    setNote("");
    setError(null);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "refund-requests"] });
    close();
  };

  const approve = useMutation({
    mutationFn: () => approveRefundRequest(openId as string, note.trim() || undefined),
    onSuccess: refresh,
    onError: (err: unknown) =>
      setError(errorMessage(err, "Could not approve the refund.")),
  });

  const reject = useMutation({
    mutationFn: () => rejectRefundRequest(openId as string, note.trim()),
    onSuccess: refresh,
    onError: (err: unknown) =>
      setError(errorMessage(err, "Could not reject the request.")),
  });

  const rows = listQuery.data?.requests ?? [];
  const detail = detailQuery.data;
  const preview = detail?.live || detail?.preview || null;
  const currency = preview?.currency || detail?.booking?.currency || "USD";

  const balanceAfter = useMemo(() => {
    if (!detail?.supplierBalance || !preview) return null;
    return detail.supplierBalance.available - Number(preview.charge || 0);
  }, [detail, preview]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Refund requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Suppliers asking to refund a delivered trip. Approving refunds the traveller and
            charges the supplier's balance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => listQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} className={listQuery.isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              status === tab.key
                ? "border-[#044b3b] bg-[#044b3b] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Refund</th>
              <th className="px-4 py-3">Charge</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 size={16} className="mr-2 inline animate-spin" /> Loading requests…
                </td>
              </tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Nothing here.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const p = row.preview;
              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    setOpenId(row.id);
                    setNote("");
                    setError(null);
                  }}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.requestNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{row.supplier?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.booking?.bookingNumber}
                    <span className="block text-xs text-slate-400">
                      {row.booking?.tourTitle} · {formatDate(row.booking?.travelDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {money(p?.proposed, p?.currency || row.booking?.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {money(p?.charge, p?.currency || row.booking?.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={close} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {detail?.requestNumber || "Refund request"}
                </h2>
                <p className="text-sm text-slate-500">
                  {detail?.booking?.tourTitle} · {detail?.booking?.bookingNumber}
                </p>
              </div>
              <button type="button" onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {detailQuery.isLoading || !detail ? (
              <div className="px-6 py-10 text-center text-slate-500">
                <Loader2 size={16} className="mr-2 inline animate-spin" /> Loading…
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Traveller refund</p>
                    <p className="text-base font-semibold text-slate-900">{money(preview?.proposed, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Charge to supplier</p>
                    <p className="text-base font-semibold text-slate-900">{money(preview?.charge, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Booking total</p>
                    <p className="font-medium text-slate-900">{money(preview?.gross, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Refundable / already refunded</p>
                    <p className="font-medium text-slate-900">
                      {money(preview?.refundable, currency)} / {money(preview?.refundedSoFar, currency)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Supplier's request</p>
                  <p className="mt-1 text-slate-700">
                    <strong>{detail.payload?.refundType === "PERCENT" ? `${detail.payload?.value}%` : money(detail.payload?.value, currency)}</strong>
                    {" · "}
                    {detail.payload?.reasonCode?.replaceAll("_", " ").toLowerCase()}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Tour operated: {detail.payload?.operated ? "Yes" : "No"} · Customer attended:{" "}
                    {detail.payload?.attended ? "Yes" : "No"}
                  </p>
                  {detail.payload?.note && (
                    <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-slate-600">“{detail.payload.note}”</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Filed by {detail.payload?.requestedByEmail || detail.supplier?.email || "supplier"}
                  </p>
                </div>

                {detail.supplierBalance && (
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
                      <Wallet size={13} /> Supplier balance
                    </p>
                    <p className="mt-1 text-slate-700">
                      Available now <strong>{money(detail.supplierBalance.available, currency)}</strong>
                      {balanceAfter !== null && (
                        <>
                          {" "}→ after this refund{" "}
                          <strong className={balanceAfter < 0 ? "text-red-600" : "text-slate-900"}>
                            {money(balanceAfter, currency)}
                          </strong>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      The charge is netted off the next payout — it is never taken from their bank
                      account.
                    </p>
                    {balanceAfter !== null && balanceAfter < 0 && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        This pushes the supplier's balance negative. That is allowed — the traveller
                        is still owed the refund — but their next payout is held until it clears.
                      </p>
                    )}
                  </div>
                )}

                {detail.blocked && (
                  <div className="rounded-lg bg-red-50 px-3 py-2.5 text-red-700">{detail.blocked}</div>
                )}

                {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-red-700">{error}</div>}

                {canDecide ? (
                  <>
                    <div>
                      <label htmlFor="decision-note" className="text-xs uppercase tracking-wide text-slate-500">
                        Note {detail.status === "PENDING_APPROVAL" ? "(required to reject)" : ""}
                      </label>
                      <textarea
                        id="decision-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#044b3b] focus:outline-none"
                        placeholder="Context for the supplier, or why this is being declined."
                      />
                    </div>
                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={reject.isPending || approve.isPending || !note.trim()}
                        onClick={() => reject.mutate()}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={approve.isPending || reject.isPending || !!detail.blocked || detail.status !== "PENDING_APPROVAL"}
                        onClick={() => approve.mutate()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#044b3b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#033629] disabled:opacity-50"
                      >
                        {approve.isPending && <Loader2 size={14} className="animate-spin" />}
                        Approve &amp; refund
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-slate-500">
                    You can review this request, but approving a refund needs the
                    {" "}<strong>payouts.approve</strong> permission.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
