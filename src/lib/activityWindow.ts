import type { ActivityWindow } from "@/types/activity";

/**
 * Resolve a window into explicit instants in the *viewer's* timezone.
 *
 * The backend's day boundaries are UTC, so "today" went empty at UTC midnight
 * for anyone west of UTC — an operator at 7pm local saw the feed vanish
 * overnight. Sending the range makes "today" the calendar day the viewer is
 * actually in; the server clamps it (never into the future, never more than 92
 * days back).
 */
export function windowRange(window: ActivityWindow): { from: string; to: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (window === "yesterday") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 1);
    return { from: start.toISOString(), to: startOfToday.toISOString() };
  }

  if (window === "week") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  return { from: startOfToday.toISOString(), to: now.toISOString() };
}

/** Human label for the range a window covers, in the viewer's locale. */
export function windowRangeLabel(window: ActivityWindow): string {
  const { from, to } = windowRange(window);
  const format = (instant: string) =>
    new Date(instant).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (window === "week") {
    // `to` is now, so step back a day to show the last full date in the range.
    return `${format(from)} – ${format(new Date(Date.parse(to) - 24 * 3600 * 1000).toISOString())}`;
  }
  return format(from);
}
