import { Building2, Wallet, Check, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PayoutMethodData {
  id: string;
  type?: string;
  details?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
  branchCode?: string;
  branchName?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  bankCountry?: string;
  currency?: string;
  paypalEmail?: string;
  isDefault?: boolean;
  verified?: boolean;
  createdAt?: string;
}

interface PayoutMethodCardProps {
  method: PayoutMethodData;
  onVerifyToggle?: (methodId: string, verified: boolean) => void;
  verifying?: boolean;
  className?: string;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">{label}</p>
      <p className="mt-0.5 truncate text-sm text-text-primary">{value}</p>
    </div>
  );
}

export function PayoutMethodCard({ method, onVerifyToggle, verifying, className }: PayoutMethodCardProps) {
  const typeKey = (method.type || "").toLowerCase();
  const isBank = typeKey.includes("bank");
  const isPaypal = typeKey.includes("paypal");
  const Icon = isBank ? Building2 : Wallet;
  const iconWrap = isBank ? "bg-status-approved/10 text-status-approved" : "bg-status-flagged/10 text-status-flagged";
  const accent = isBank ? "border-status-approved/30" : "border-status-flagged/30";

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface-base shadow-sm", className)}>
      <div className={cn("flex items-center justify-between border-b bg-gradient-to-r from-surface-base to-surface-muted/60 px-5 py-3.5", accent)}>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconWrap)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{method.type?.replace(/_/g, " ") || "Payment Method"}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {method.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-active/10 px-2 py-0.5 text-[10px] font-semibold text-status-active">
                  <Check className="h-3 w-3" /> Default
                </span>
              )}
              {method.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-active/10 px-2 py-0.5 text-[10px] font-medium text-status-active">
                  <CheckCircle className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-pending/10 px-2 py-0.5 text-[10px] font-medium text-status-pending">
                  <AlertCircle className="h-3 w-3" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>
        {onVerifyToggle && (
          <button
            onClick={() => onVerifyToggle(method.id, !method.verified)}
            disabled={verifying}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              method.verified
                ? "border-status-pending/30 text-status-pending hover:bg-status-pending/10"
                : "border-status-active/40 text-status-active hover:bg-status-active/10"
            )}
          >
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {method.verified ? "Mark Unverified" : "Mark Verified"}
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {isBank && <Field label="Bank Name" value={method.bankName} />}
          <Field label="Account Name" value={method.accountName} />
          {isBank && <Field label="Account Number" value={method.accountNumber} />}
          {isBank && <Field label="Sort Code" value={method.sortCode} />}
          {isBank && <Field label="Branch Code" value={method.branchCode} />}
          {isBank && <Field label="Branch Name" value={method.branchName} />}
          {isBank && <Field label="SWIFT / BIC" value={method.swiftCode} />}
          {isBank && <Field label="IBAN" value={method.iban} />}
          {isBank && <Field label="Routing Number" value={method.routingNumber} />}
          {isPaypal && <Field label="PayPal Email" value={method.paypalEmail} />}
          <Field label="Currency" value={method.currency} />
          <Field label="Country" value={method.bankCountry} />
        </div>
        {method.details && <p className="text-xs text-text-tertiary">{method.details}</p>}
      </div>
    </div>
  );
}
