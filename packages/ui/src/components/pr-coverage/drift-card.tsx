'use client';

import { AlertTriangle, Check, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import type { DriftIssue } from './types';

interface DriftCardProps {
  issue: DriftIssue;
  onView?: () => void;
  onFix?: () => void;
  className?: string;
}

const severityConfig = {
  high: { label: 'High', className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', className: 'bg-warning/15 text-warning' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
};

export function DriftCard({ issue, onView, onFix, className }: DriftCardProps) {
  const isResolved = issue.status === 'resolved';
  const severity = severityConfig[issue.severity];

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4',
        isResolved && 'opacity-60',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium',
            isResolved ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
        >
          {isResolved ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
          {issue.type}
          {isResolved && ' (fixed)'}
        </span>

        {!isResolved && (
          <span className={cn('text-[11px] font-medium px-2 py-1 rounded', severity.className)}>
            {severity.label}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3">{issue.description}</p>

      {/* Location */}
      <div className="font-mono text-xs text-muted-foreground mb-3">
        <a href={`#${issue.filePath}`} className="text-primary hover:underline underline-offset-2">
          {issue.filePath}
        </a>
        :{issue.line}
        {issue.functionName && (
          <>
            {' · '}
            <code className="text-foreground">{issue.functionName}()</code>
          </>
        )}
      </div>

      {/* Actions */}
      {!isResolved && (onView || onFix) && (
        <div className="flex items-center gap-2">
          {onView && (
            <Button variant="secondary" size="sm" onClick={onView}>
              <Eye className="size-3.5" />
              View
            </Button>
          )}
          {onFix && (
            <Button
              variant="primary"
              size="sm"
              onClick={onFix}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              Fix
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface DriftSectionProps {
  introduced: DriftIssue[];
  resolved: DriftIssue[];
  onViewIssue?: (issue: DriftIssue) => void;
  onFixIssue?: (issue: DriftIssue) => void;
  onFixAll?: () => void;
  className?: string;
}

export function DriftSection({
  introduced,
  resolved,
  onViewIssue,
  onFixIssue,
  onFixAll,
  className,
}: DriftSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Introduced */}
      {introduced.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="size-3.5 text-warning" />
              Introduced (+{introduced.length})
            </div>
            {onFixAll && introduced.length > 1 && (
              <Button variant="secondary" size="sm" onClick={onFixAll}>
                Fix All
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {introduced.map((issue) => (
              <DriftCard
                key={issue.id}
                issue={{ ...issue, status: 'introduced' }}
                onView={onViewIssue ? () => onViewIssue(issue) : undefined}
                onFix={onFixIssue ? () => onFixIssue(issue) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            <Check className="size-3.5 text-success" />
            Resolved (-{resolved.length})
          </div>
          <div className="space-y-3">
            {resolved.map((issue) => (
              <DriftCard key={issue.id} issue={{ ...issue, status: 'resolved' }} />
            ))}
          </div>
        </div>
      )}

      {introduced.length === 0 && resolved.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Check className="size-8 mx-auto mb-3 text-success" />
          <p className="font-medium">No drift issues in this PR</p>
        </div>
      )}
    </div>
  );
}
