import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { HelpCircle, Globe, Percent, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/axios";
import { queryClient } from "@/lib/query-client";
import { isSuperAdmin } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { useUnsavedChangesWarning, useCtrlSave, QueryErrorState, SettingsCard, FormSkeleton, SettingsSaveBar, type FieldDef, validateAllFields } from "./shared";

const CURRENCIES = ["USD", "EUR", "GBP", "KES", "TZS", "UGX", "RWF", "ZAR", "NGN", "GHS"];
const TIMEZONES = ["UTC", "Africa/Dar_es_Salaam", "Africa/Nairobi", "Africa/Kampala", "Africa/Kigali", "Africa/Johannesburg", "Africa/Lagos", "America/New_York", "Europe/London"];
const PAYOUT_SCHEDULES = ["daily", "weekly", "biweekly", "monthly"];

const FIELDS: FieldDef[] = [
  { key: "platform.name", label: "Platform Name", type: "text", required: true, section: "Platform" },
  { key: "platform.currency", label: "Currency", type: "select", required: true, options: CURRENCIES, section: "Platform" },
  { key: "platform.support_email", label: "Support Email", type: "email", required: true, section: "Platform" },
  { key: "platform.timezone", label: "Timezone", type: "select", required: true, options: TIMEZONES, section: "Platform" },
  { key: "commission.default_rate", label: "Default Commission (%)", type: "number", required: true, min: 0, max: 100, step: 0.1, section: "Commission & Fees" },
  { key: "commission.platform_fee", label: "Platform Fee", type: "number", required: true, min: 0, step: 0.01, section: "Commission & Fees" },
  { key: "payout.min_threshold", label: "Min Payout Threshold", type: "number", required: true, min: 0, step: 1, section: "Commission & Fees" },
  { key: "payout.schedule", label: "Payout Schedule", type: "select", required: true, options: PAYOUT_SCHEDULES, section: "Commission & Fees" },
  { key: "booking.min_advance_hours", label: "Min Advance Booking (hours)", type: "number", required: true, min: 0, section: "Booking Rules" },
  { key: "booking.max_advance_days", label: "Max Advance Booking (days)", type: "number", required: true, min: 1, section: "Booking Rules" },
  { key: "booking.auto_cancel_hours", label: "Auto-Cancel After (hours)", type: "number", required: true, min: 0, section: "Booking Rules" },
  { key: "booking.max_travelers", label: "Max Travelers Per Booking", type: "number", required: true, min: 1, section: "Booking Rules" },
];

const SECTION_LABELS: Record<string, { title: string; desc: string }> = {
  Platform: { title: "Platform", desc: "General platform information and regional settings" },
  "Commission & Fees": { title: "Commission & Fees", desc: "Platform revenue and payout configuration" },
  "Booking Rules": { title: "Booking Rules", desc: "Default constraints for new bookings" },
};

const SECTION_ICONS: Record<string, ReactNode> = {
  Platform: <Globe className="h-4 w-4" />,
  "Commission & Fees": <Percent className="h-4 w-4" />,
  "Booking Rules": <CalendarClock className="h-4 w-4" />,
};

export function GeneralTab() {
  const superAdmin = isSuperAdmin();
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sections = useMemo(() => [...new Set(FIELDS.map((f) => f.section))], []);

  const totalChanged = useMemo(
    () => FIELDS.filter((f) => original[f.key] !== undefined && form[f.key] !== original[f.key]).length,
    [form, original],
  );

  const anyDirty = totalChanged > 0;

  useUnsavedChangesWarning(anyDirty);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings").then((r) => r.data?.data || {}),
  });

  const [prevData, setPrevData] = useState<unknown>(null);
  if (data && data !== prevData && Object.keys(original).length === 0) {
    setPrevData(data);
    const flattened: Record<string, string> = {};
    for (const [key, val] of Object.entries(data)) {
      flattened[key] = String(val ?? "");
    }
    for (const f of FIELDS) {
      if (!(f.key in flattened)) flattened[f.key] = "";
    }
    setForm(flattened);
    setOriginal(flattened);
  }

  const mutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api.put("/admin/settings", { settings }),
    onSuccess: (res) => {
      const saved = res.data?.data || {};
      const flattened: Record<string, string> = {};
      for (const [key, val] of Object.entries(saved)) {
        flattened[key] = String(val ?? "");
      }
      for (const f of FIELDS) {
        if (!(f.key in flattened)) flattened[f.key] = "";
      }
      setForm(flattened);
      setOriginal(flattened);
      setErrors({});
      queryClient.setQueryData(["admin", "settings"], saved);
      toast.success("Settings saved successfully");
    },
    onError: () => toast.error("Failed to save settings. Please try again."),
  });

  const update = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const field = FIELDS.find((f) => f.key === key);
    if (field) {
      const err = validateAllFields([field], { [key]: value })[key];
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next[key] = err;
        else delete next[key];
        return next;
      });
    }
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = useCallback(() => {
    const allErrors = validateAllFields(FIELDS, form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      toast.error("Please fix the highlighted errors before saving");
      return;
    }
    const dirtyKeys = FIELDS.filter(
      (f) => original[f.key] !== undefined && form[f.key] !== original[f.key],
    ).map((f) => f.key);
    if (dirtyKeys.length === 0) return;
    const dirtyForm: Record<string, string> = {};
    for (const k of dirtyKeys) {
      dirtyForm[k] = form[k] ?? "";
    }
    mutation.mutate(dirtyForm);
  }, [form, original, mutation]);

  const handleResetAll = useCallback(() => {
    setForm({ ...original });
    setErrors({});
  }, [original]);

  useCtrlSave(handleSave, anyDirty && !hasErrors);

  if (isLoading) return <FormSkeleton rows={3} fieldsPerRow={2} />;

  if (isError) return <QueryErrorState title="Failed to load settings" message="Could not fetch platform settings from the server." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const sectionFields = FIELDS.filter((f) => f.section === section);
          const sectionErrors = sectionFields.filter((f) => errors[f.key]).length;
          return (
            <SettingsCard
              key={section}
              title={SECTION_LABELS[section]?.title || section}
              description={SECTION_LABELS[section]?.desc || ""}
              icon={SECTION_ICONS[section]}
              errorCount={sectionErrors}
            >
              <div className="space-y-5">
                {sectionFields.map((field) => {
                  const value = form[field.key] ?? "";
                  const error = errors[field.key];
                  const isChanged = original[field.key] !== undefined && form[field.key] !== original[field.key];

                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor={field.key}
                        className={cn(
                          "text-sm font-medium",
                          error ? "text-red-600" : isChanged ? "text-amber-700" : "text-text-primary",
                        )}
                      >
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      {isChanged && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    {field.type === "select" ? (
                      <Select
                        value={value}
                        onValueChange={(v) => update(field.key, v)}
                        disabled={!superAdmin || mutation.isPending}
                      >
                        <SelectTrigger
                          id={field.key}
                          className={cn(error && "border-red-400 ring-red-400/50")}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        onChange={(e) => update(field.key, e.target.value)}
                        disabled={!superAdmin || mutation.isPending}
                        className={cn(error && "border-red-400 ring-red-400/50")}
                      />
                    )}
                    {field.hint && (
                      <p className="text-xs text-text-tertiary">{field.hint}</p>
                    )}
                    {error && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <HelpCircle className="h-3 w-3 text-red-500 shrink-0" />
                        <p className="text-xs text-red-500">{error}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SettingsCard>
        );
      })}
      </div>

      {superAdmin && (
        <SettingsSaveBar
          dirty={anyDirty}
          changedCount={totalChanged}
          hasErrors={hasErrors}
          isPending={mutation.isPending}
          onSave={handleSave}
          onReset={handleResetAll}
        />
      )}
    </div>
  );
}