const v = (name: string) => `hsl(var(--${name}))`;

/** Indigo leads; supporting hues only separate series. */
export const chartColors = {
  green: v("chart-1"),
  blue: v("chart-2"),
  amber: v("chart-3"),
  red: v("chart-4"),
  violet: v("chart-5"),
} as const;

export const chartAxis = {
  grid: v("border"),
  tick: v("text-tertiary"),
  axis: v("border"),
  reference: v("border"),
} as const;

export const chartSeries = Object.values(chartColors);
