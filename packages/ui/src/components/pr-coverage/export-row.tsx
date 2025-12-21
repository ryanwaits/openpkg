'use client';

import { AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KindBadge } from '../badge';
import type { ChangeType, ExportItem, ExportKind } from './types';

interface ExportRowProps {
  export: ExportItem;
  onViewSource?: () => void;
  onAddDocs?: () => void;
  className?: string;
}

function ChangeIndicator({ type }: { type: ChangeType }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center size-5 rounded text-xs font-semibold',
        type === '+' && 'bg-success/15 text-success',
        type === '~' && 'bg-blue-500/15 text-blue-500',
        type === '-' && 'bg-destructive/15 text-destructive',
      )}
    >
      {type}
    </div>
  );
}

function CoverageBar({ percent }: { percent: number }) {
  const getColor = () => {
    if (percent >= 100) return 'bg-success';
    if (percent > 0) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', getColor())}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusIndicator({
  status,
  missing,
}: {
  status: ExportItem['status'];
  missing?: string[];
}) {
  const config = {
    documented: { icon: Check, color: 'text-success', label: 'fully documented' },
    partial: { icon: AlertTriangle, color: 'text-warning', label: missing?.[0] || 'partial' },
    undocumented: { icon: X, color: 'text-destructive', label: 'no documentation' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', color)}>
      <Icon className="size-3.5" />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

const kindMap: Record<
  ExportKind,
  'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable'
> = {
  function: 'function',
  class: 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  variable: 'variable',
};

export function ExportRow({ export: exp, className }: ExportRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[24px_1fr_50px_140px_auto] items-center gap-3',
        'px-4 py-3 border-b border-border last:border-b-0',
        'hover:bg-muted/30 transition-colors',
        className,
      )}
    >
      <ChangeIndicator type={exp.changeType} />

      <div className="flex items-center gap-2.5 min-w-0">
        <span className="font-mono text-sm truncate">
          {exp.name}
          {exp.kind === 'function' && '()'}
        </span>
        <KindBadge kind={kindMap[exp.kind]} size="sm" />
      </div>

      <div className="font-mono text-sm text-right tabular-nums">{exp.coverage}%</div>

      <CoverageBar percent={exp.coverage} />

      <StatusIndicator status={exp.status} missing={exp.missing} />
    </div>
  );
}
