/**
 * User Growth — bucket formatting + CSV helpers.
 *
 * Kept separate from the page component so the page file only exports
 * components (react-refresh) and these pure functions are unit-testable.
 */

export type Granularity = "day" | "week" | "month";

export interface GrowthRow {
  month: string;
  total: number;
  customers: number;
  suppliers: number;
}

/**
 * Parse a backend bucket label ("2026-10" or "2026-10-05") into a local date.
 * Timezone-stable — never round-trips through ISO strings, so it is immune to
 * the "Invalid Date" bug that hit month labels ending in "Z".
 */
export function parseBucket(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  // Full-string match: only bare YYYY-MM / YYYY-MM-DD bucket labels are
  // accepted. ISO timestamps ("…T00:00:00.000Z") must NOT prefix-match.
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

export function formatAxisLabel(value: unknown, granularity: Granularity): string {
  const d = parseBucket(value);
  if (!d) return String(value ?? "");
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTooltipLabel(value: unknown, granularity: Granularity): string {
  const d = parseBucket(value);
  if (!d) return String(value ?? "");
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function buildGrowthCsv(rows: GrowthRow[]): string {
  const header = ["Bucket", "Total", "Customers", "Suppliers"];
  const lines = rows.map((r) => [r.month, r.total, r.customers, r.suppliers].join(","));
  return [header.join(","), ...lines].join("\n");
}