import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Check,
  X,
  RefreshCw,
  CalendarClock,
  Link as LinkIcon,
  Car,
  IdCard,
  Building2,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import { usePermission } from "@/hooks/usePermission";
import { cn, formatDate, documentTypeLabel, supplierTypeLabel } from "@/lib/utils";
import api from "@/lib/axios";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Doc {
  id: string;
  type: string;
  status: string;
  url: string;
  filename?: string | null;
  ownerType: string;
  expiryDate?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  registrationNumber: string;
  photos: string[];
  status: string;
  reviewNote?: string | null;
}

interface Guide {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  status: string;
  reviewNote?: string | null;
}

interface VerificationData {
  supplierType?: string;
  documents: Doc[];
  vehicles: Vehicle[];
  guides: Guide[];
}

export default function SupplierVerificationPanel({ supplierId }: { supplierId: string }) {  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [tab, setTab] = useState<"documents" | "vehicles" | "guides">("documents");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "supplier-verification", supplierId],
    queryFn: () => api.get(`/suppliers/admin/${supplierId}/verification`).then((r) => r.data?.data as VerificationData),
  });

  const approve = can("suppliers.approve");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted/40 px-4 py-3">
        <Building2 className="h-4 w-4 text-text-secondary" />
        <span className="text-sm text-text-secondary">Supplier type:</span>
        <span className="text-sm font-semibold text-text-primary">{supplierTypeLabel(data?.supplierType)}</span>
      </div>

      <div className="flex gap-2 border-b border-border-muted">
        {([
          { key: "documents", label: `Documents (${data?.documents?.length ?? 0})` },
          { key: "vehicles", label: `Vehicles (${data?.vehicles?.length ?? 0})` },
          { key: "guides", label: `Guides (${data?.guides?.length ?? 0})` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors focus:outline-none",
              tab === t.key ? "border-b-2 border-primary text-primary" : "text-text-secondary hover:text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tab === "documents" ? (
        <DocumentsTab documents={data?.documents || []} editable={approve} onMutated={() => queryClient.invalidateQueries({ queryKey: ["admin", "supplier-verification", supplierId] })} />
      ) : tab === "vehicles" ? (
        <VehiclesTab vehicles={data?.vehicles || []} editable={approve} onMutated={() => queryClient.invalidateQueries({ queryKey: ["admin", "supplier-verification", supplierId] })} />
      ) : (
        <GuidesTab guides={data?.guides || []} editable={approve} onMutated={() => queryClient.invalidateQueries({ queryKey: ["admin", "supplier-verification", supplierId] })} />
      )}
    </div>
  );
}

function DocumentsTab({ documents, editable, onMutated }: { documents: Doc[]; editable: boolean; onMutated: () => void }) {
  if (documents.length === 0) {
    return <Card><CardContent className="p-6"><SectionEmpty message="No documents submitted" /></CardContent></Card>;
  }
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} editable={editable} onMutated={onMutated} />
      ))}
    </div>
  );
}

function DocumentRow({ doc, editable, onMutated }: { doc: Doc; editable: boolean; onMutated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "request_replacement">("approve");
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState(doc.expiryDate ? String(doc.expiryDate).slice(0, 10) : "");
  const [busy, setBusy] = useState(false);

  const reviewerOwner = doc.ownerType !== "SUPPLIER";

  const submit = async () => {
    if ((action === "reject" || action === "request_replacement") && note.length < 3) {
      toast.error("Please add a note explaining the decision");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/suppliers/admin/documents/${doc.id}`, {
        action,
        note: note || undefined,
        ...(action === "approve" && expiry ? { expiryDate: expiry } : {}),
      });
      toast.success(action === "approve" ? "Document approved" : action === "reject" ? "Document rejected" : "Replacement requested");
      setExpanded(false);
      setNote("");
      onMutated();
    } catch {
      toast.error("Failed to update document");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-base">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-tertiary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{documentTypeLabel(doc.type)}</p>
            <StatusBadge status={doc.status} />
            {reviewerOwner && <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-tertiary">attached to {doc.ownerType.toLowerCase()}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
            {doc.expiryDate && (
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> expires {formatDate(doc.expiryDate)}</span>
            )}
            {doc.reviewedAt && <span>reviewed {formatDate(doc.reviewedAt)}</span>}
            {doc.reviewNote && <span className="text-status-rejected">note: {doc.reviewNote}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-primary"
          >
            <LinkIcon className="h-3 w-3" /> View
          </a>
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setAction("approve"); setExpanded((v) => !v); }}>
                <Check className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setAction("reject"); setExpanded((v) => !v); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAction("request_replacement"); setExpanded((v) => !v); }}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace
              </Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="flex flex-wrap gap-4">
            {action === "approve" && (
              <div className="w-full sm:w-56">
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Expiry date (optional)</p>
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </div>
            )}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={action === "approve" ? "Add an optional internal note…" : "Reason (required)…"}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm {action === "reject" ? "rejection" : action === "request_replacement" ? "replacement request" : "approval"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VehiclesTab({ vehicles, editable, onMutated }: { vehicles: Vehicle[]; editable: boolean; onMutated: () => void }) {
  if (vehicles.length === 0) return <Card><CardContent className="p-6"><SectionEmpty message="No vehicles listed" /></CardContent></Card>;
  return (
    <div className="space-y-3">
      {vehicles.map((v) => <VehicleRow key={v.id} vehicle={v} editable={editable} onMutated={onMutated} />)}
    </div>
  );
}

function VehicleRow({ vehicle, editable, onMutated }: { vehicle: Vehicle; editable: boolean; onMutated: () => void }) {
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const review = async (action: "approve" | "reject") => {
    if (action === "reject" && note.length < 3) { toast.error("Add a reason for rejection"); return; }
    setBusy(true);
    try {
      await api.patch(`/suppliers/admin/vehicles/${vehicle.id}`, { action, note: note || undefined });
      toast.success(action === "approve" ? "Vehicle verified" : "Vehicle rejected");
      setExpanded(false);
      setNote("");
      onMutated();
    } catch {
      toast.error("Failed to update vehicle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-base">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-tertiary">
          <Car className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}</p>
            <StatusBadge status={vehicle.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-tertiary">Reg: {vehicle.registrationNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          {vehicle.photos.slice(0, 3).map((p, i) => (
            <OptimizedImage key={i} src={p} alt="" width={48} className="h-10 w-10 rounded-md border border-border object-cover" />
          ))}
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setExpanded((v) => !v); }}>
                <Check className="mr-1 h-3.5 w-3.5" /> Verify
              </Button>
              <Button size="sm" variant="destructive" onClick={() => review("reject")}>Reject</Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vehicle inspection note…" rows={2} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button>
            <Button size="sm" onClick={() => review("approve")} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Confirm verification
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GuidesTab({ guides, editable, onMutated }: { guides: Guide[]; editable: boolean; onMutated: () => void }) {
  if (guides.length === 0) return <Card><CardContent className="p-6"><SectionEmpty message="No guides added" /></CardContent></Card>;
  return (
    <div className="space-y-3">
      {guides.map((g) => <GuideRow key={g.id} guide={g} editable={editable} onMutated={onMutated} />)}
    </div>
  );
}

function GuideRow({ guide, editable, onMutated }: { guide: Guide; editable: boolean; onMutated: () => void }) {
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const review = async (action: "approve" | "reject") => {
    if (action === "reject" && note.length < 3) { toast.error("Add a reason for rejection"); return; }
    setBusy(true);
    try {
      await api.patch(`/suppliers/admin/guides/${guide.id}`, { action, note: note || undefined });
      toast.success(action === "approve" ? "Guide verified" : "Guide rejected");
      setExpanded(false);
      setNote("");
      onMutated();
    } catch {
      toast.error("Failed to update guide");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-border bg-surface-base">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-tertiary">
          <IdCard className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{guide.fullName}</p>
            <StatusBadge status={guide.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-tertiary">{[guide.phone, guide.email].filter(Boolean).join(" · ") || "No contact details"}</p>
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setExpanded((v) => !v); }}>
              <Check className="mr-1 h-3.5 w-3.5" /> Verify
            </Button>
            <Button size="sm" variant="destructive" onClick={() => review("reject")}>Reject</Button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Guide verification note…" rows={2} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button>
            <Button size="sm" onClick={() => review("approve")} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Confirm verification
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}