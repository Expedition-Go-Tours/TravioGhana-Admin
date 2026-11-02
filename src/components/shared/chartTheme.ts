const v = (name: string) => `hsl(var(--${name}))`;

/** Green-led data ramp; gold and ruby keep adjacent series distinct. */
export const chartColors = {
  primary: v("chart-1"),
  emerald: v("chart-2"),
  gold: v("chart-3"),
  ruby: v("chart-4"),
  olive: v("chart-5"),
} as const;

export const chartAxis = {
  grid: v("border"),
  tick: v("text-tertiary"),
  axis: v("border"),
  reference: v("border"),
} as const;

export const chartSeries = Object.values(chartColors);
