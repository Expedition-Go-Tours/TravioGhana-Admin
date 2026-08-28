interface ChartTooltipEntry {
  dataKey?: string;
  color?: string;
  name?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  formatter?: (value: number | string, name?: string) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-base p-3 shadow-soft-lg">
      <p className="mb-2 text-xs font-medium text-text-tertiary">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const color = entry.color;
          const raw = entry.value ?? 0;
          const display = formatter ? formatter(raw, entry.name) : Number(raw).toLocaleString();
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
              {color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
              <span className="text-text-secondary">{entry.name}:</span>
              <span className="font-semibold text-text-primary tabular-nums">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
