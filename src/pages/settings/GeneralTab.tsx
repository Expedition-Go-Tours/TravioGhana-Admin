import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Percent, CalendarClock, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/axios";
import { queryClient } from "@/lib/query-client";
import { isSuperAdmin } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import {
  useUnsavedChangesWarning,
  useCtrlSave,
  QueryErrorState,
  SettingsCard,
  SettingsRow,
  SettingsNotice,
  FormSkeleton,
  SettingsSaveBar,
  type FieldDef,
  validateAllFields,
} from "./shared";
import { percentFromStored, percentToStored } from "./settings-utils";

const CURRENCIES = ["GHS", "NGN", "KES", "TZS", "UGX", "RWF", "ZAR", "USD", "EUR", "GBP"];
const TIMEZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Dar_es_Salaam",
  "Africa/Kampala",
  "Africa/Kigali",
  "Africa/Johannesburg",
  "UTC",
  "Europe/London",
  "America/New_York",
];

// Mirrors the backend PayoutCycle enum. WEEKLY was retired with the v3
// invoicing migration and is rejected by the settings validator.
const PAYOUT_CYCLES = ["TWICE_MONTHLY", "MONTHLY"];
const PAYOUT_CYCLE_LABELS: Record<string, string> = {
  TWICE_MONTHLY: "Twice a month — the 1st and 15th",
  MONTHLY: "Monthly — the 1st",
};

const FIELDS: FieldDef[] = [
  {
    key: "platform.name",
    label: "Platform name",
    type: "text",
    required: true,
    section: "Platform",
    hint: "Shown in the admin console, customer emails, and supplier documents.",
  },
  {
    key: "platform.currency",
    label: "Settlement currency",
    type: "select",
    required: true,
    options: CURRENCIES,
    section: "Platform",
    hint: "Used for new bookings and payouts. Existing bookings keep their original currency.",
  },
  {
    key: "platform.timezone",
    label: "Timezone",
    type: "select",
    required: true,
    options: TIMEZONES,
    section: "Platform",
    hint: "Controls reporting days, payout cut-offs, and scheduled jobs.",
  },
  {
    key: "platform.support_email",
    label: "Support email",
    type: "email",
    required: true,
    section: "Platform",
    hint: "Replies from travelers and suppliers are routed here.",
  },

  {
    key: "commission.default_rate",
    label: "Base commission",
    type: "number",
    required: true,
    min: 0.01,
    max: 100,
    step: 0.1,
    suffix: "%",
    section: "Commission & Fees",
    defaultValue: "15",
    hint: "Charged on every new booking. A booking keeps the rate it was created with.",
  },
  {
    key: "commission.surcharge_rate",
    label: "Additional commission",
    type: "number",
    required: true,
    min: 0,
    max: 100,
    step: 0.1,
    suffix: "%",
    section: "Commission & Fees",
    defaultValue: "0",
    hint: "Added on top of the base rate. Leave at 0 for a flat commission.",
  },
  {
    key: "commission.platform_fee",
    label: "Platform fee",
    type: "number",
    required: true,
    min: 0,
    step: 0.01,
    section: "Commission & Fees",
    hint: "A fixed fee per booking, separate from the percentage commission.",
  },
  {
    key: "payout.min_threshold",
    label: "Minimum payout",
    type: "number",
    required: true,
    min: 0,
    step: 1,
    section: "Commission & Fees",
    hint: "Suppliers cannot request a payout below this amount.",
  },
  {
    key: "payout.default_cycle",
    label: "Default payout schedule",
    type: "select",
    required: true,
    options: PAYOUT_CYCLES,
    optionLabels: PAYOUT_CYCLE_LABELS,
    section: "Commission & Fees",
    hint: "Applied to new and un-enrolled suppliers. Suppliers can change their own schedule.",
  },
  {
    key: "payout.auto_generate_enabled",
    label: "Automatic payout runs",
    type: "toggle",
    required: true,
    defaultValue: "true",
    section: "Commission & Fees",
    hint: "Pausing stops the scheduler. Enrolled suppliers can still withdraw manually.",
  },

  {
    key: "booking.min_advance_hours",
    label: "Minimum advance notice",
    type: "number",
    required: true,
    min: 0,
    suffix: "hours",
    section: "Booking Rules",
    hint: "The shortest notice a traveler can give before a departure.",
  },
  {
    key: "booking.max_advance_days",
    label: "Maximum booking window",
    type: "number",
    required: true,
    min: 1,
    suffix: "days",
    section: "Booking Rules",
    hint: "How far ahead a departure can be booked.",
  },
  {
    key: "booking.auto_cancel_hours",
    label: "Auto-cancel unpaid bookings",
    type: "number",
    required: true,
    min: 0,
    suffix: "hours",
    section: "Booking Rules",
    hint: "Unpaid reservations are released after this window.",
  },
  {
    key: "booking.max_travelers",
    label: "Maximum travelers",
    type: "number",
    required: true,
    min: 1,
    section: "Booking Rules",
    hint: "The largest party size allowed in a single booking.",
  },

  // Mirrors paymentLinkService.FLAGS. A missing row means off at runtime, so
  // defaultValue shows the effective state on first load.
  {
    key: "feature.payLaterPaymentAttempts.ghana",
    label: "Hosted payment links",
    type: "toggle",
    required: true,
    defaultValue: "false",
    section: "Payment links",
    hint: "Master switch for hosted Stripe Checkout on pay-later bookings.",
  },
  {
    key: "feature.supplierPaymentLinks.ghana",
    label: "Supplier-sent links",
    type: "toggle",
    required: true,
    defaultValue: "false",
    section: "Payment links",
    hint: "Lets suppliers send, resend, or regenerate a secure link from the booking drawer.",
  },
  {
    key: "feature.payLaterPaymentRecovery.ghana",
    label: "Automatic recovery",
    type: "toggle",
    required: true,
    defaultValue: "false",
    section: "Payment links",
    hint: "Emails a new link after a failed deferred charge, at most twice per booking.",
  },
  {
    key: "feature.paymentLinkChat.ghana",
    label: "Post links in chat",
    type: "toggle",
    required: true,
    defaultValue: "false",
    section: "Payment links",
    hint: "Adds “Also post the link in chat” to payment-link actions.",
  },
];

const PAYMENT_LINK_SECTION = "Payment links";
const PAYMENT_LINK_MASTER_KEY = "feature.payLaterPaymentAttempts.ghana";
const PAYMENT_LINK_DEPENDENT_KEYS = new Set([
  "feature.supplierPaymentLinks.ghana",
  "feature.payLaterPaymentRecovery.ghana",
  "feature.paymentLinkChat.ghana",
]);

// These settings are stored as decimal fractions (0.15) but edited as whole
// percentages (15). Converting at the boundary keeps both views honest.
const PERCENT_FIELDS = new Set(["commission.default_rate", "commission.surcharge_rate"]);

const SECTION_META: Record<string, { title: string; description: string; icon: ReactNode }> = {
  Platform: {
    title: "Platform",
    description: "Identity, currency, and locale used across the admin and traveler apps.",
    icon: <Globe className="h-4 w-4" />,
  },
  "Commission & Fees": {
    title: "Commission & fees",
    description: "How Travio earns on each booking and when suppliers get paid.",
    icon: <Percent className="h-4 w-4" />,
  },
  "Booking Rules": {
    title: "Booking rules",
    description: "Guardrails applied to every new reservation.",
    icon: <CalendarClock className="h-4 w-4" />,
  },
  "Payment links": {
    title: "Payment links",
    description:
      "Hosted Stripe Checkout for pay-later bookings. Changes apply within a minute; links already sent stay payable until they expire.",
    icon: <CreditCard className="h-4 w-4" />,
  },
};

function buildForm(data: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    flat[key] = String(value ?? "");
  }

  const form: Record<string, string> = {};
  for (const field of FIELDS) {
    let value = flat[field.key] ?? "";
    if (value === "") value = field.defaultValue ?? "";
    else if (PERCENT_FIELDS.has(field.key)) value = percentFromStored(value);
    form[field.key] = value;
  }
  return form;
}

function storedValue(field: FieldDef, display: string): string {
  return PERCENT_FIELDS.has(field.key) ? percentToStored(display) : display;
}

export function GeneralTab() {
  const superAdmin = isSuperAdmin();
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sections = useMemo(() => [...new Set(FIELDS.map((field) => field.section))], []);

  const totalChanged = useMemo(
    () => FIELDS.filter((field) => original[field.key] !== undefined && form[field.key] !== original[field.key]).length,
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
    const next = buildForm(data as Record<string, unknown>);
    setForm(next);
    setOriginal(next);
  }

  const mutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) => api.put("/admin/settings", { settings }),
    onSuccess: (response) => {
      const saved = (response.data?.data || {}) as Record<string, unknown>;
      const next = buildForm(saved);
      setForm(next);
      setOriginal(next);
      setErrors({});
      queryClient.setQueryData(["admin", "settings"], saved);
      toast.success("Settings saved");
    },
    onError: () => toast.error("Could not save settings. Please try again."),
  });

  const update = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const field = FIELDS.find((item) => item.key === key);
    if (!field) return;
    const error = validateAllFields([field], { [key]: value })[key];
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = useCallback(() => {
    const allErrors = validateAllFields(FIELDS, form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      toast.error("Fix the highlighted fields before saving");
      return;
    }

    const dirtyFields = FIELDS.filter(
      (field) => original[field.key] !== undefined && form[field.key] !== original[field.key],
    );
    if (dirtyFields.length === 0) return;

    const payload: Record<string, string> = {};
    for (const field of dirtyFields) {
      payload[field.key] = storedValue(field, form[field.key] ?? "");
    }
    mutation.mutate(payload);
  }, [form, original, mutation]);

  const handleResetAll = useCallback(() => {
    setForm({ ...original });
    setErrors({});
  }, [original]);

  useCtrlSave(handleSave, anyDirty && !hasErrors);

  if (isLoading) return <FormSkeleton rows={3} fieldsPerRow={2} />;

  if (isError) {
    return (
      <QueryErrorState
        title="Settings unavailable"
        message="We could not load the platform settings. Check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  const currency = form["platform.currency"] || "GHS";
  const masterOn = form[PAYMENT_LINK_MASTER_KEY] === "true";
  const dependentOn = [...PAYMENT_LINK_DEPENDENT_KEYS].some((key) => form[key] === "true");

  const baseRate = Number.parseFloat(form["commission.default_rate"] ?? "");
  const surchargeRate = Number.parseFloat(form["commission.surcharge_rate"] ?? "");
  const effectiveRate =
    Number.isFinite(baseRate) && Number.isFinite(surchargeRate)
      ? Math.round((baseRate + surchargeRate) * 100) / 100
      : null;

  return (
    <div className="space-y-5">
      {!superAdmin && (
        <SettingsNotice>
          You have view-only access to platform settings. Ask a super admin to make changes.
        </SettingsNotice>
      )}

      {sections.map((section) => {
        const sectionFields = FIELDS.filter((field) => field.section === section);
        const sectionErrors = sectionFields.filter((field) => errors[field.key]).length;
        const meta = SECTION_META[section];
        const isPaymentLinks = section === PAYMENT_LINK_SECTION;

        return (
          <SettingsCard
            key={section}
            title={meta.title}
            description={meta.description}
            icon={meta.icon}
            errorCount={sectionErrors}
          >
            {isPaymentLinks && !masterOn && dependentOn && (
              <SettingsNotice tone="warning">
                These options do nothing until <strong className="font-semibold">Hosted payment links</strong> is on.
              </SettingsNotice>
            )}

            <div className="divide-y divide-border">
              {sectionFields.map((field) => {
                const value = form[field.key] ?? "";
                const error = errors[field.key];
                const isChanged = original[field.key] !== undefined && form[field.key] !== original[field.key];
                const isDependent = PAYMENT_LINK_DEPENDENT_KEYS.has(field.key);
                const disabled =
                  !superAdmin || mutation.isPending || (isDependent && !masterOn);

                let description = field.hint;
                if (isDependent && !masterOn) {
                  description = `Requires hosted payment links. ${field.hint ?? ""}`.trim();
                }

                const control =
                  field.type === "toggle" ? (
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs font-medium text-text-tertiary">
                        {value === "true" ? "On" : "Off"}
                      </span>
                      <Switch
                        checked={value === "true"}
                        onCheckedChange={(checked) => update(field.key, checked ? "true" : "false")}
                        disabled={disabled}
                        aria-label={field.label}
                      />
                    </div>
                  ) : field.type === "select" ? (
                    <Select
                      value={value}
                      onValueChange={(next) => update(field.key, next)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        id={field.key}
                        className={cn("w-full", error && "border-status-rejected/40 ring-status-rejected/20")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const options = field.options || [];
                          // Keep an unrecognised stored value selectable instead of
                          // rendering a blank trigger. The server is the authority on
                          // whether it will accept a new value.
                          const visibleOptions = value && !options.includes(value) ? [...options, value] : options;
                          return visibleOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {field.optionLabels?.[option] ?? option}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      {(field.prefix || field.key === "commission.platform_fee" || field.key === "payout.min_threshold") && (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-text-tertiary">
                          {field.prefix ?? currency}
                        </span>
                      )}
                      <Input
                        id={field.key}
                        type={field.type}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        onChange={(event) => update(field.key, event.target.value)}
                        disabled={disabled}
                        inputMode={field.type === "number" ? "decimal" : undefined}
                        className={cn(
                          "tnum",
                          (field.prefix || field.key === "commission.platform_fee" || field.key === "payout.min_threshold") && "pl-14",
                          field.suffix && "pr-16",
                          error && "border-status-rejected/40 ring-status-rejected/20",
                        )}
                      />
                      {field.suffix && (
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-text-tertiary">
                          {field.suffix}
                        </span>
                      )}
                    </div>
                  );

                return (
                  <SettingsRow
                    key={field.key}
                    label={field.label}
                    description={description}
                    htmlFor={field.type === "toggle" ? undefined : field.key}
                    dirty={isChanged}
                    error={error}
                    disabled={disabled}
                  >
                    {control}
                  </SettingsRow>
                );
              })}
            </div>

            {section === "Commission & Fees" && effectiveRate !== null && (
              <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-text-primary">Effective commission</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    Base {baseRate}% + additional {surchargeRate}%, applied to new bookings.
                  </p>
                </div>
                <span className="tnum text-lg font-semibold text-text-primary">{effectiveRate}%</span>
              </div>
            )}
          </SettingsCard>
        );
      })}

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
