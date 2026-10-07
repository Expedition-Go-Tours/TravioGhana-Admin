// Bank/transaction reference hygiene, shared by every money-marking flow
// (legacy payout requests and finance-v3 invoices). Mirrors backend
// normalizeReference: block placeholders and nonsense lengths without
// enforcing a single format (bank references vary by institution).

export const REFERENCE_PLACEHOLDERS = ["n/a", "na", "none", "null", "test", "tbd", "xxx", "-", "pending"];

export function validateReference(v: string): string | null {
  const value = v.trim().replace(/\s+/g, " ");
  if (!value) return "A transaction reference is required";
  if (REFERENCE_PLACEHOLDERS.includes(value.toLowerCase())) return "Looks like a placeholder. Enter the actual bank/PayPal reference";
  if (value.length < 4) return "Too short. A real reference has at least 4 characters";
  if (value.length > 100) return "Too long. Max 100 characters";
  return null;
}
