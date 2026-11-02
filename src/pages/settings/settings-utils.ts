/**
 * Commission settings are stored as decimal fractions (0.15) but edited as
 * whole percentages (15). These helpers keep the conversion at one boundary.
 */
export function percentFromStored(raw: string): string {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return "";
  return String(Math.round((value > 1 ? value : value * 100) * 100) / 100);
}

export function percentToStored(display: string): string {
  const value = Number.parseFloat(display);
  if (!Number.isFinite(value)) return "";
  return String(value / 100);
}
