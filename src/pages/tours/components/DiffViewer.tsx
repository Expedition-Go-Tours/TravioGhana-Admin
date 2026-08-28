import { GitCompareArrows, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TourDraftDiff } from '@/services/tourService';

interface ChangesSummary {
  count: number;
  sections: { section: string; changes: number; paths: string[] }[];
}

interface DiffViewerProps {
  diff: TourDraftDiff[];
  changesSummary: ChangesSummary;
}

function formatDiffPath(path: string) {
  return path.split('.').join(' › ');
}

export function DiffViewer({ diff, changesSummary }: DiffViewerProps) {
  if (diff.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-surface-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No pending changes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="info" className="gap-1">
          <ListChecks className="h-3 w-3" />
          {changesSummary.count} change{changesSummary.count === 1 ? '' : 's'}
        </Badge>
        {changesSummary.sections.map((s) => (
          <Badge key={s.section} variant="secondary">
            {s.section} ({s.changes})
          </Badge>
        ))}
      </div>

      {/* Diff rows */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {diff.map((entry) => (
          <div
            key={entry.path}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider break-all">
                {formatDiffPath(entry.path)}
              </p>
              <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
                {entry.before !== undefined && (
                  <span className="rounded bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 line-through max-w-xs truncate">
                    {entry.before}
                  </span>
                )}
                <GitCompareArrows className="h-3 w-3 text-text-tertiary shrink-0" />
                {entry.after !== undefined && (
                  <span className="rounded bg-emerald-50 border border-emerald-100 text-emerald-700 px-1.5 py-0.5 max-w-xs truncate">
                    {entry.after}
                  </span>
                )}
              </div>
            </div>
            <Badge
              variant={entry.kind === 'removed' ? 'error' : entry.kind === 'added' ? 'success' : 'warning'}
              className="shrink-0 capitalize"
            >
              {entry.kind}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
