/**
 * Copy for the two search entry points (header dropdown and command palette).
 *
 * Search only fans out to tours and suppliers when the viewer holds the
 * matching permission, so the hint must not promise scopes the viewer cannot
 * open. A blog-only admin should read "Search pages…", not "Search pages,
 * tours and suppliers…".
 */
export function searchScopes(canSearchTours: boolean, canSearchSuppliers: boolean): string {
  if (!canSearchTours && !canSearchSuppliers) return "pages";
  if (canSearchTours && canSearchSuppliers) return "pages, tours and suppliers";
  return canSearchTours ? "pages and tours" : "pages and suppliers";
}
