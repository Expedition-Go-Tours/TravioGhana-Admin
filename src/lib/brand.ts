/**
 * Brand identity for this admin dashboard.
 *
 * What this dashboard is allowed to *see* is never decided here. Requests are
 * brand-scoped twice over: the axios interceptor rewrites every `/admin/*` call
 * to `/travioghana/admin/*`, and the API then filters notifications by
 * `storefront` server-side before pagination. This module only lets the UI
 * state which brand it is showing, and keeps the brand in one place so porting
 * this code to the Africa admin is a two-line change instead of a hunt for
 * hardcoded strings.
 */

export const BRAND_KEY = "ghana" as const;
export const BRAND_NAME = "Travio Ghana";

/**
 * Every value `AdminNotification.storefront` can carry. `null` means the
 * notification is platform-wide and was not attributable to a single storefront.
 */
export type Storefront = "ghana" | "expedition" | null;

const STOREFRONT_NAMES: Record<string, string> = {
  ghana: "Travio Ghana",
  expedition: "Expedition Go",
};

/** Human-readable name for a storefront, falling back to the raw value. */
export function storefrontLabel(storefront: Storefront | string | null | undefined): string {
  if (storefront === null || storefront === undefined || storefront === "") return "Platform-wide";
  return STOREFRONT_NAMES[storefront] ?? String(storefront);
}

/**
 * True when the notification belongs to this dashboard's own brand.
 *
 * Row-level brand chips are suppressed for these. On a Ghana-scoped feed every
 * row carries `storefront: "ghana"`, so labelling each one would just repeat
 * the page title down the list. The chip only renders when it actually says
 * something — a platform-wide notice, or a cross-storefront item on an admin
 * whose feed is mixed.
 */
export function isOwnStorefront(storefront: Storefront | string | null | undefined): boolean {
  return storefront === BRAND_KEY;
}
