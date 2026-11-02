/* eslint-disable react-refresh/only-export-components -- shared settings library module (hooks + helpers + components) */
import { useEffect, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

export function useCtrlSave(handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handler();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handler, enabled]);
}

export function flattenSettings(data: Record<string, unknown>): Record<string, string> {
  const flattened: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    flattened[key] = String(val ?? "");
  }
  return flattened;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "select" | "url" | "toggle";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  /** Optional friendly labels for `options` (falls back to the raw value). */
  optionLabels?: Record<string, string>;
  /**
   * Used when the server has no row for this key yet. Without it a `required`
   * select renders empty and blocks saving every other setting, which is how a
   * new flag would break the whole page on the day it ships.
   */
  defaultValue?: string;
  section: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}

export function validateField(field: FieldDef, value: string): string | null {
  if (field.type === "toggle") return null;
  if (field.required && !value.trim()) return `${field.label} is required`;
  if (!value.trim()) return null;
  if (field.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address";
  }
  if (field.type === "url" && value.trim()) {
    try { new URL(value); } catch { return "Please enter a valid URL"; }
  }
  if (field.type === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) return "Must be a valid number";
    if (field.min !== undefined && num < field.min) return `Must be at least ${field.min}`;
    if (field.max !== undefined && num > field.max) return `Must be at most ${field.max}`;
  }
  return null;
}

export function validateAllFields(fields: FieldDef[], form: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const err = validateField(field, form[field.key] ?? "");
    if (err) errors[field.key] = err;
  }
  return errors;
}

export function QueryErrorState({
  title = "Failed to load data",
  message = "Could not fetch data from the server. Please check your connection and try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base px-8 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-status-rejected/10 mb-5 ring-1 ring-status-rejected/30">
        <AlertTriangle className="h-6 w-6 text-status-rejected-text" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary mb-7 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2 ">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}

export function FormSkeleton({ rows = 3, fieldsPerRow = 4 }: { rows?: number; fieldsPerRow?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: rows }).map((_, s) => (
        <div key={s} className="overflow-hidden rounded-xl border border-border bg-surface-base">
          <div className="flex items-center gap-3 px-6 py-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 border-t border-border px-6 py-5 md:grid-cols-2">
            {Array.from({ length: fieldsPerRow }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  icon,
  children,
  className,
  errorCount,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  errorCount?: number;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-base",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-text-primary">
              {title}
            </h3>
            <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-text-tertiary">
              {description}
            </p>
          </div>
        </div>
        {errorCount !== undefined && errorCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-status-rejected/30 bg-status-rejected/10 px-2.5 py-0.5 text-xs font-medium text-status-rejected-text">
            <span className="h-1.5 w-1.5 rounded-full bg-status-rejected" />
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="border-t border-border px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  dirty,
  error,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  dirty?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-start sm:gap-8",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <label
            htmlFor={htmlFor}
            className={cn(
              "text-sm font-medium",
              error
                ? "text-status-rejected-text"
                : disabled
                  ? "text-text-tertiary"
                  : "text-text-primary",
            )}
          >
            {label}
          </label>
          {dirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending"
              title="Unsaved change"
            />
          )}
        </div>
        {description && (
          <p
            className={cn(
              "mt-1 max-w-prose text-[13px] leading-relaxed",
              error ? "text-status-rejected-text" : "text-text-tertiary",
            )}
          >
            {description}
          </p>
        )}
        {error && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-status-rejected-text">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
      <div className="min-w-0 sm:w-[260px] sm:justify-self-end">{children}</div>
    </div>
  );
}

export function SettingsNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "warning"
          ? "border-status-pending/30 bg-status-pending/10 text-status-pending-text"
          : "border-primary/20 bg-primary/5 text-text-secondary",
      )}
    >
      {children}
    </div>
  );
}

export function SettingsSaveBar({
  dirty,
  changedCount,
  hasErrors,
  isPending,
  onSave,
  onReset,
}: {
  dirty: boolean;
  changedCount: number;
  hasErrors: boolean;
  isPending: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty && !isPending) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-sm text-text-secondary">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        All changes saved
      </div>
    );
  }

  return (
    <div className="sticky bottom-4 z-20 rounded-xl border border-border bg-surface-base px-4 py-3 sm:px-5">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm">
          <span className="flex items-center gap-2 font-medium text-status-pending-text">
            <span className="h-2 w-2 rounded-full bg-status-pending" />
            {changedCount} unsaved change{changedCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 hidden text-[11px] text-text-tertiary sm:inline">⌘S to save</span>
          <Button variant="outline" onClick={onReset} disabled={!dirty || isPending} className="flex-1 sm:flex-none">
            Discard
          </Button>
          <Button onClick={onSave} disabled={!dirty || hasErrors || isPending} className="flex-1 gap-2 sm:flex-none">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
