import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: 'default' | 'pending' | 'success' | 'warning' | 'error';
  className?: string;
}

const variantStyles = {
  default: 'bg-secondary text-secondary-foreground',
  pending: 'bg-status-pending/8 text-status-pending-text',
  success: 'bg-status-active/8 text-status-active-text',
  warning: 'bg-status-flagged/8 text-status-flagged-text',
  error: 'bg-status-rejected/8 text-status-rejected-text',
};

const iconStyles = {
  default: 'text-muted-foreground',
  pending: 'text-status-pending-text',
  success: 'text-status-active-text',
  warning: 'text-status-flagged-text',
  error: 'text-status-rejected-text',
};

export function TourStatCard({ label, value, icon: Icon, variant = 'default', className }: TourStatCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-2.5',
        variantStyles[variant],
        className
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', iconStyles[variant])} />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-base font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
