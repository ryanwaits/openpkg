'use client';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Lightbulb,
  Pencil,
  Rows2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { DiffViewer } from './diff-viewer';
import type { DriftReviewPanelProps } from './types';

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'ml-2 inline-flex items-center justify-center px-1.5 py-0.5',
        'text-[10px] font-mono font-medium',
        'bg-muted rounded border border-border',
        'text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function IssueBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1',
        'bg-warning/15 text-warning',
        'rounded text-xs font-mono font-medium',
      )}
    >
      <AlertTriangle className="size-3" />
      {type}
    </span>
  );
}

export function DriftReviewPanel({
  issue,
  fix,
  onAccept,
  onReject,
  onSkip,
  onEdit,
  onPrev,
  onNext,
  position,
  status,
  viewMode,
  onViewModeChange,
}: DriftReviewPanelProps) {
  const isAccepted = status === 'accepted';
  const isRejected = status === 'rejected';
  const isSkipped = status === 'skipped';
  const hasDecision = isAccepted || isRejected || isSkipped;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card overflow-hidden',
        'transition-all duration-200',
        isAccepted && 'border-success/50 ring-1 ring-success/20',
        isRejected && 'border-destructive/50 ring-1 ring-destructive/20',
        !hasDecision && 'border-border',
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <IssueBadge type={issue.type} />
          <div className="text-sm font-mono text-muted-foreground">
            <a
              href={`#${issue.filePath}`}
              className="text-primary hover:underline underline-offset-2"
            >
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
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              type="button"
              onClick={() => onViewModeChange('split')}
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'split'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              title="Split view"
            >
              <Columns2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('unified')}
              className={cn(
                'p-1.5 transition-colors border-l border-border',
                viewMode === 'unified'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              title="Unified view"
            >
              <Rows2 className="size-4" />
            </button>
          </div>

          <span className="text-sm text-muted-foreground tabular-nums">
            {position.current} of {position.total}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-4 border-b border-border space-y-3">
        <p className="text-sm text-muted-foreground">{issue.description}</p>

        {issue.suggestion && (
          <div
            className={cn(
              'flex items-start gap-2.5 p-3',
              'bg-accent/50 rounded-md',
              'text-sm text-foreground',
            )}
          >
            <Lightbulb className="size-4 text-warning shrink-0 mt-0.5" />
            <span>{issue.suggestion}</span>
          </div>
        )}
      </div>

      {/* Diff view */}
      <div className="p-4">
        <DiffViewer before={fix.before} after={fix.after} language={fix.language} mode={viewMode} />
      </div>

      {/* Status indicator for decided issues */}
      {hasDecision && (
        <div
          className={cn(
            'px-5 py-3 border-t border-border',
            'flex items-center gap-2 text-sm font-medium',
            isAccepted && 'bg-success/10 text-success',
            isRejected && 'bg-destructive/10 text-destructive',
            isSkipped && 'bg-muted text-muted-foreground',
          )}
        >
          {isAccepted && (
            <>
              <Check className="size-4" />
              Fix accepted
            </>
          )}
          {isRejected && (
            <>
              <X className="size-4" />
              Marked as intentional
            </>
          )}
          {isSkipped && 'Skipped'}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 bg-muted/30 border-t border-border flex items-center justify-between">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrev}
            disabled={position.current === 1}
            className="px-2"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNext}
            disabled={position.current === position.total}
            className="px-2"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onSkip}>
            Skip
            <Kbd>s</Kbd>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={onReject}
            className={cn(isRejected && 'ring-2 ring-destructive')}
          >
            <X className="size-4" />
            Reject
            <Kbd>r</Kbd>
          </Button>

          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
            <Kbd>e</Kbd>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onAccept}
            className={cn(
              'bg-success hover:bg-success/90 text-success-foreground',
              isAccepted && 'ring-2 ring-success',
            )}
          >
            <Check className="size-4" />
            Accept Fix
            <Kbd className="bg-success-foreground/20 border-success-foreground/30 text-success-foreground">
              a
            </Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
