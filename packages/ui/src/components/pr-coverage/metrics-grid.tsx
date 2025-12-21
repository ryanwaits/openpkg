'use client';

import { AlertTriangle, ArrowDown, ArrowUp, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import type { PRMetrics } from './types';

interface MetricsGridProps {
  metrics: PRMetrics;
  onFixDrift?: () => void;
  className?: string;
}

function CoverageBar({
  percent,
  variant = 'default',
}: {
  percent: number;
  variant?: 'success' | 'warning' | 'error' | 'default';
}) {
  const getBarColor = () => {
    if (variant !== 'default') {
      return variant === 'success'
        ? 'bg-success'
        : variant === 'warning'
          ? 'bg-warning'
          : 'bg-destructive';
    }
    if (percent >= 80) return 'bg-success';
    if (percent >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', getBarColor())}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function MetricCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-5', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {label}
      </div>
      {children}
    </div>
  );
}

function DeltaBadge({ value, showSign = true }: { value: number; showSign?: boolean }) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        isPositive && 'bg-success/15 text-success',
        isNegative && 'bg-destructive/15 text-destructive',
        !isPositive && !isNegative && 'bg-muted text-muted-foreground',
      )}
    >
      {isPositive && <ArrowUp className="size-3" />}
      {isNegative && <ArrowDown className="size-3" />}
      {showSign && isPositive && '+'}
      {value}%
    </span>
  );
}

export function MetricsGrid({ metrics, onFixDrift, className }: MetricsGridProps) {
  const coverageDelta = metrics.projectCoverage.after - metrics.projectCoverage.before;
  const netDrift = metrics.driftDelta.introduced - metrics.driftDelta.resolved;
  const isPatchPassing = metrics.patchCoverage >= metrics.patchCoverageTarget;

  return (
    <div className={cn('grid grid-cols-4 gap-4', className)}>
      {/* Patch Coverage */}
      <MetricCard label="Patch Coverage">
        <div className="text-3xl font-bold mb-2">{metrics.patchCoverage}%</div>
        <CoverageBar
          percent={metrics.patchCoverage}
          variant={isPatchPassing ? 'success' : 'warning'}
        />
        <div className="text-xs text-muted-foreground mt-2">
          target: {metrics.patchCoverageTarget}%
        </div>
      </MetricCard>

      {/* Project Coverage */}
      <MetricCard label="Project Coverage">
        <div className="text-3xl font-bold mb-2">{metrics.projectCoverage.after}%</div>
        <CoverageBar percent={metrics.projectCoverage.after} variant="warning" />
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>
            {metrics.projectCoverage.before}% → {metrics.projectCoverage.after}%
          </span>
          <DeltaBadge value={coverageDelta} />
        </div>
      </MetricCard>

      {/* New Exports */}
      <MetricCard label="New Exports">
        <div className="text-3xl font-bold mb-3">+{metrics.newExports.total}</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-2 text-success">
            <Check className="size-3.5" />
            {metrics.newExports.documented} documented
          </div>
          {metrics.newExports.undocumented > 0 && (
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-3.5" />
              {metrics.newExports.undocumented} undocumented
            </div>
          )}
        </div>
      </MetricCard>

      {/* Drift Delta */}
      <MetricCard label="Drift Delta">
        <div className="text-3xl font-bold mb-3">
          {netDrift > 0 ? '+' : ''}
          {netDrift}
        </div>
        <div className="flex gap-4 text-sm mb-3">
          <span className="text-destructive">+{metrics.driftDelta.introduced} introduced</span>
          <span className="text-success">-{metrics.driftDelta.resolved} resolved</span>
        </div>
        {metrics.driftDelta.introduced > 0 && onFixDrift && (
          <Button variant="secondary" size="sm" onClick={onFixDrift} className="w-full">
            Fix All
          </Button>
        )}
      </MetricCard>
    </div>
  );
}
