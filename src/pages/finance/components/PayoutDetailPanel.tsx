import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X,
  User,
  MapPin,
  Calendar,
  Hash,
  DollarSign,
  Wallet,
  Building2,
  Smartphone,
  Percent,
  CheckCircle,
  Send,
  XCircle,
  Ban,
  Globe,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Payout } from "@/types/payout";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface PayoutDetailPanelProps {
  payout: Payout;
  supplierPhotoUrl?: string;
  onClose: () => void;
  onApprove?: (payout: Payout) => void;
  onRelease?: (payout: Payout) => void;
  onSettle?: (payout: Payout) => void;
  onFail?: (payout: Payout) => void;
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xs font-medium text-text-primary text-right">{children}</div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function PayoutDetailPanel({ payout, supplierPhotoUrl, onClose, onApprove, onRelease, onSettle, onFail }: PayoutDetailPanelProps) {
  const navigate = useNavigate();

  const status = payout.status || "UNKNOWN";
  const amount = Number(payout.amount) || 0;
  const commission = Number(payout.commissionAmount ?? payout.commission ?? 0);
  const commissionPct = amount > 0 ? ((commission / amount) * 100).toFixed(1) : null;
  const netPayout = amount - commission;

  const method = payout.payoutMethod;
  const isBank = method?.type?.toLowerCase().includes("bank");
  const MethodIcon = isBank ? Building2 : Wallet;

  const timelineSteps = [
    { label: "Created", date: payout.createdAt || null, active: true },
    { label: "Approved", date: payout.approvedAt || null, active: ["APPROVED", "PROCESSING", "PAID"].includes(status) },
    { label: "Processing", date: payout.processedAt || null, active: ["PROCESSING", "PAID"].includes(status) },
    { label: status === "FAILED" ? "Failed" : "Paid", date: payout.paidAt || null, active: status === "PAID" || status === "FAILED" },
  ];

  const supplier = payout.supplier;
  const photoUrl = supplierPhotoUrl || supplier?.photoURL || supplier?.user?.photoURL;
  const businessInfo = supplier?.supplierProfile?.businessInfo;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full sm:w-[480px] bg-surface-base border-l border-border shadow-[-4px_0_16px_rgba(0,0,0,0.06)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="h-4 w-4 text-text-tertiary shrink-0" />
            <h2 className="text-sm font-semibold text-text-primary truncate">Payout {payout.id.slice(0, 8)}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Status Banner */}
          <div className="flex items-center gap-2 border-b bg-surface-muted/40 px-5 py-3 text-xs font-semibold">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-pending" />
            {status.replace(/_/g, " ")}
          </div>

          {/* Amount Hero */}
          <div className="px-5 py-5 border-b border-border">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Payout Amount</p>
            <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(amount)}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge status={status} />
              {payout.reference && (
                <span className="text-[11px] text-text-tertiary">Ref: {payout.reference}</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Supplier Information */}
            <div>
              <SectionDivider label="Supplier Info" />
              <div className="flex items-start gap-3 mb-3">
                <button
                  onClick={() => supplier?.id && navigate(`/admin/suppliers/${supplier.id}`)}
                  className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  title="View supplier profile"
                >
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-sm font-semibold text-text-secondary ring-2 ring-border">
                    <span className={photoUrl ? "opacity-0" : ""}>{(supplier?.name || "?").charAt(0).toUpperCase()}</span>
                    {photoUrl && (
                      <OptimizedImage
                        src={photoUrl}
                        alt={supplier?.name || ""}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover"
                        width={40}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{supplier?.name || "—"}</p>
                  {businessInfo?.legalBusinessName && businessInfo.legalBusinessName !== supplier?.name && (
                    <p className="text-[11px] text-text-tertiary truncate">{businessInfo.legalBusinessName}</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3 space-y-0.5">
                <DetailRow icon={<User className="h-3 w-3" />} label="Display Name">{supplier?.name || "—"}</DetailRow>
                {businessInfo?.legalBusinessName && (
                  <DetailRow icon={<Building2 className="h-3 w-3" />} label="Legal Name">{businessInfo.legalBusinessName}</DetailRow>
                )}
                {supplier?.email && (
                  <DetailRow icon={<Wallet className="h-3 w-3" />} label="Email">{supplier.email}</DetailRow>
                )}
                {(supplier?.phone || businessInfo?.phone || businessInfo?.phoneNumber) && (
                  <DetailRow icon={<Smartphone className="h-3 w-3" />} label="Phone">{supplier?.phone || businessInfo?.phone || businessInfo?.phoneNumber || "—"}</DetailRow>
                )}
                {businessInfo?.country && (
                  <DetailRow icon={<Globe className="h-3 w-3" />} label="Country">{businessInfo.country}</DetailRow>
                )}
                {(businessInfo?.city || (typeof businessInfo?.address === 'string' ? businessInfo?.address : businessInfo?.address?.city)) && (
                  <DetailRow icon={<MapPin className="h-3 w-3" />} label="City">{(typeof businessInfo?.address === 'string' ? businessInfo?.address : businessInfo?.address?.city) || businessInfo?.city}</DetailRow>
                )}
              </div>
            </div>

            {/* Booking Details */}
            {(payout.booking || payout.tour) && (
              <div>
                <SectionDivider label="Booking Details" />
                <div className="rounded-xl border border-border p-3 space-y-0.5">
                  {payout.booking?.bookingNumber && (
                    <DetailRow icon={<Hash className="h-3 w-3" />} label="Booking #">{payout.booking.bookingNumber}</DetailRow>
                  )}
                  {(payout.booking?.tour?.title || payout.tour?.title) && (
                    <DetailRow icon={<MapPin className="h-3 w-3" />} label="Tour">{payout.booking?.tour?.title || payout.tour?.title}</DetailRow>
                  )}
                  {payout.booking?.grossAmount && (
                    <DetailRow icon={<DollarSign className="h-3 w-3" />} label="Total">{formatCurrency(payout.booking.grossAmount)}</DetailRow>
                  )}
                  {payout.createdAt && (
                    <DetailRow icon={<Calendar className="h-3 w-3" />} label="Created">{formatDate(payout.createdAt)}</DetailRow>
                  )}
                  {payout.approvedAt && (
                    <DetailRow icon={<CheckCircle className="h-3 w-3" />} label="Approved">{formatDate(payout.approvedAt)}</DetailRow>
                  )}
                  {payout.processedAt && (
                    <DetailRow icon={<Send className="h-3 w-3" />} label="Released">{formatDateTime(payout.processedAt)}</DetailRow>
                  )}
                  {payout.paidAt && (
                    <DetailRow icon={<Clock className="h-3 w-3" />} label="Paid At">{formatDateTime(payout.paidAt)}</DetailRow>
                  )}
                </div>
              </div>
            )}

            {/* Commission Breakdown */}
            <div>
              <SectionDivider label="Commission Breakdown" />
              <div className="rounded-xl border border-border p-4 space-y-2">
                <DetailRow icon={<DollarSign className="h-3 w-3" />} label="Booking Amount">{formatCurrency(amount + commission)}</DetailRow>
                <DetailRow icon={<Percent className="h-3 w-3" />} label="Commission">
                  {formatCurrency(commission)}
                  {commissionPct && <span className="text-text-tertiary ml-1">({commissionPct})</span>}
                </DetailRow>
                <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Net Payout</span>
                  <span className="text-sm font-bold text-status-active tabular-nums">{formatCurrency(netPayout)}</span>
                </div>
              </div>
            </div>

            {/* Payout Method */}
            {method?.type && (
              <div>
                <SectionDivider label="Payout Method" />
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
                      <MethodIcon className="h-4 w-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{method.type?.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {method.verified !== undefined && (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            method.verified ? "bg-status-active/10 text-status-active" : "bg-status-pending/10 text-status-pending"
                          )}>
                            {method.verified ? "Verified" : "Unverified"}
                          </span>
                        )}
                        {method.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-approved/10 px-2 py-0.5 text-[10px] font-medium text-status-approved">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {method.details && (
                    <p className="text-xs text-text-secondary">{method.details}</p>
                  )}
                  {method.bankName && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                      {method.bankName && <Field label="Bank" value={method.bankName} />}
                      {method.accountNumber && <Field label="Account" value={method.accountNumber} />}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <SectionDivider label="Timeline" />
              <div className="rounded-xl border border-border p-4">
                <div className="space-y-0">
                  {timelineSteps.map((step, idx) => {
                    const isLast = idx === timelineSteps.length - 1;
                    const dotClass = step.active
                      ? "bg-status-processing border-status-processing/30"
                      : step.date
                      ? "bg-status-active border-status-active/30"
                      : "bg-border border-border";
                    return (
                      <div key={step.label} className="relative flex gap-3">
                        {!isLast && (
                          <div className={cn(
                            "absolute left-[11px] top-5 w-0.5 h-full -translate-x-1/2",
                            step.date ? "bg-status-processing/40" : "bg-border"
                          )} />
                        )}
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn("h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center", dotClass)}
                          >
                            {step.date && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="h-2 w-2 rounded-full bg-current"
                              />
                            )}
                          </motion.div>
                        </div>
                        <div className={cn("pb-5", isLast && "pb-0")}>
                          <p className={cn(
                            "text-xs font-medium",
                            step.active ? "text-status-processing" : step.date ? "text-text-primary" : "text-text-tertiary"
                          )}>
                            {step.label}
                          </p>
                          {step.date && (
                            <p className="text-[10px] text-text-tertiary mt-0.5">
                              {new Date(step.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-5 py-4 shrink-0 space-y-2">
          {status === "PENDING" && onApprove && (
            <Button
              onClick={() => { onApprove(payout); onClose(); }}
              className="w-full gap-1.5"
              size="sm"
            >
              <CheckCircle className="h-4 w-4" /> Approve Payout
            </Button>
          )}
          {status === "APPROVED" && (
            <div className="flex gap-2">
              {onRelease && (
                <Button
                  onClick={() => { onRelease(payout); onClose(); }}
                  className="flex-1 gap-1.5"
                  size="sm"
                >
                  <Send className="h-4 w-4" /> Release
                </Button>
              )}
              {onFail && (
                <Button
                  onClick={() => { onFail(payout); onClose(); }}
                  variant="outline"
                  className="flex-1 gap-1.5 border-status-rejected/30 text-status-rejected hover:bg-status-rejected/10"
                  size="sm"
                >
                  <XCircle className="h-4 w-4" /> Fail
                </Button>
              )}
            </div>
          )}
          {status === "PROCESSING" && (
            <div className="flex gap-2">
              {onSettle && (
                <Button
                  onClick={() => { onSettle(payout); onClose(); }}
                  className="flex-1 gap-1.5"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4" /> Settle
                </Button>
              )}
              {onFail && (
                <Button
                  onClick={() => { onFail(payout); onClose(); }}
                  variant="outline"
                  className="flex-1 gap-1.5 border-status-rejected/30 text-status-rejected hover:bg-status-rejected/10"
                  size="sm"
                >
                  <Ban className="h-4 w-4" /> Fail
                </Button>
              )}
            </div>
          )}
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-text-tertiary"
            size="sm"
          >
            Close
          </Button>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-sm bg-surface-muted/50 px-3 py-2">
      <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-text-primary">{value || "—"}</p>
    </div>
  );
}
