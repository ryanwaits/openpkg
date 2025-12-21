'use client';

import { AlertTriangle, Check, Eye, EyeOff, Sparkles, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { DRIFT_TYPE_LABELS, type DriftIssue, type DriftSeverity } from './types';

interface DriftCommandCardProps {
  issue: DriftIssue;
  onView?: () => void;
  onFix?: () => void;
  onIgnore?: () => void;
  className?: string;
}

const severityConfig: Record<
  DriftSeverity,
  { label: string; dotClass: string; badgeClass: string }
> = {
  high: {
    label: 'High',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
  medium: {
    label: 'Medium',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning/15 text-warning',
  },
  low: {
    label: 'Low',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
};

const statusIcons = {
  pending: <AlertTriangle className="size-3.5" />,
  reviewing: <Eye className="size-3.5" />,
  accepted: <Check className="size-3.5" />,
  rejected: <EyeOff className="size-3.5" />,
  skipped: <EyeOff className="size-3.5" />,
};

export function DriftCommandCard({
  issue,
  onView,
  onFix,
  onIgnore,
  className,
}: DriftCommandCardProps) {
  const severity = severityConfig[issue.severity];
  const typeLabel = DRIFT_TYPE_LABELS[issue.type] || issue.type;
  const isResolved = issue.status === 'accepted' || issue.status === 'rejected';

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 transition-opacity',
        isResolved && 'opacity-50',
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium',
              issue.status === 'accepted'
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning',
            )}
          >
            {statusIcons[issue.status]}
            {typeLabel}
          </span>

          {/* Auto-fixable indicator */}
          {issue.isAutoFixable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="size-3" />
              Auto-fix
            </span>
          )}
        </div>

        {/* Severity indicator */}
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded shrink-0',
            severity.badgeClass,
          )}
        >
          {severity.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-2">{issue.description}</p>

      {/* Export name if present */}
      {issue.exportName && (
        <div className="font-mono text-sm text-muted-foreground mb-2">
          <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">
            {issue.exportName}()
          </code>
        </div>
      )}

      {/* File location */}
      <div className="font-mono text-xs text-muted-foreground mb-3">
        <a href={`#${issue.filePath}:${issue.line}`} className="text-primary hover:underline">
          {issue.filePath}
        </a>
        <span className="text-muted-foreground">:{issue.line}</span>
        {issue.column && <span className="text-muted-foreground">:{issue.column}</span>}
      </div>

      {/* Actions */}
      {!isResolved && (onView || onFix || onIgnore) && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {onView && (
            <Button variant="ghost" size="sm" onClick={onView} className="h-7 px-2 text-xs">
              <Eye className="size-3" />
              View
            </Button>
          )}
          {onFix && (
            <Button
              variant="primary"
              size="sm"
              onClick={onFix}
              className={cn(
                'h-7 px-2 text-xs',
                issue.isAutoFixable ? 'bg-success hover:bg-success/90 text-success-foreground' : '',
              )}
            >
              <Wrench className="size-3" />
              {issue.isAutoFixable ? 'Fix' : 'Review'}
            </Button>
          )}
          {onIgnore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onIgnore}
              className="h-7 px-2 text-xs ml-auto"
            >
              <EyeOff className="size-3" />
              Ignore
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
