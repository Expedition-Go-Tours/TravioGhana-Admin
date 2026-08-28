const v = (name: string) => `hsl(var(--${name}))`;

export const chartColors = {
  green: v("status-active"),
  blue: v("status-approved"),
  amber: v("status-pending"),
  red: v("status-rejected"),
  violet: v("chart-5"),
} as const;

export const chartAxis = {
  grid: v("border"),
  tick: v("text-tertiary"),
  axis: v("border"),
  reference: v("border"),
} as const;

export const chartSeries = Object.values(chartColors);
