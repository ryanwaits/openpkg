'use client';

import { cn } from '../../lib/utils';
import { DRIFT_SEVERITY_MAP, DRIFT_TYPE_LABELS, type DriftType } from './types';

interface DriftTypeChartProps {
  byType: Partial<Record<DriftType, number>>;
  maxCount?: number;
  onTypeClick?: (type: DriftType) => void;
  className?: string;
}

const severityBarColors = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted-foreground',
};

export function DriftTypeChart({ byType, maxCount, onTypeClick, className }: DriftTypeChartProps) {
  // Sort by count descending
  const entries = Object.entries(byType)
    .filter(([, count]) => count && count > 0)
    .sort(([, a], [, b]) => (b || 0) - (a || 0)) as [DriftType, number][];

  const max = maxCount || Math.max(...entries.map(([, count]) => count), 1);

  if (entries.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground text-center py-8', className)}>
        No drift issues by type
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {entries.map(([type, count]) => {
        const severity = DRIFT_SEVERITY_MAP[type];
        const percent = (count / max) * 100;
        const label = DRIFT_TYPE_LABELS[type] || type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onTypeClick?.(type)}
            className={cn(
              'w-full flex items-center gap-3 text-left group',
              'hover:bg-accent/50 -mx-2 px-2 py-1 rounded transition-colors',
              onTypeClick && 'cursor-pointer',
            )}
          >
            {/* Label */}
            <div className="w-36 text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
              {label}
            </div>

            {/* Bar */}
            <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden">
              <div
                className={cn('h-full rounded transition-all', severityBarColors[severity])}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Count */}
            <div className="w-8 text-right text-sm font-medium tabular-nums">{count}</div>
          </button>
        );
      })}
    </div>
  );
}
