'use client';

import { cn } from '../../lib/utils';
import type { DriftStats } from './types';

interface DriftOverviewProps {
  stats: DriftStats;
  className?: string;
}

const severityColors = {
  high: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    dot: 'bg-destructive',
  },
  medium: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  low: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export function DriftOverview({ stats, className }: DriftOverviewProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
      {/* Total Issues */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Total Issues
        </div>
        <div className="text-3xl font-semibold tabular-nums">{stats.total}</div>
      </div>

      {/* By Severity */}
      {(['high', 'medium', 'low'] as const).map((severity) => {
        const count = stats.bySeverity[severity];
        const colors = severityColors[severity];

        return (
          <div key={severity} className={cn('rounded-lg p-4', colors.bg)}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn('size-2 rounded-full', colors.dot)} />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {severity}
              </span>
            </div>
            <div className={cn('text-3xl font-semibold tabular-nums', colors.text)}>{count}</div>
          </div>
        );
      })}
    </div>
  );
}
