'use client';

import { AlertTriangle, Check, Clock, ExternalLink, RefreshCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import type { PRInfo, PRStatus } from './types';

interface PRHeaderProps {
  pr: PRInfo;
  status: PRStatus;
  statusMessage: string;
  updatedAt: string;
  onViewGitHub?: () => void;
  onRerunAnalysis?: () => void;
  onFixIssues?: () => void;
  className?: string;
}

const statusConfig: Record<
  PRStatus,
  { icon: typeof Check; color: string; bg: string; border: string }
> = {
  passing: {
    icon: Check,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
  },
  failing: {
    icon: X,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
  },
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
  },
};

export function PRHeader({
  pr,
  status,
  statusMessage,
  updatedAt,
  onViewGitHub,
  onRerunAnalysis,
  onFixIssues,
  className,
}: PRHeaderProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title & Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            PR #{pr.number}: {pr.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded font-mono text-xs">
              <span>{pr.head}</span>
              <span className="text-muted-foreground/60">→</span>
              <span>{pr.base}</span>
            </span>
            <span>
              opened {pr.openedAt} by{' '}
              {pr.authorUrl ? (
                <a href={pr.authorUrl} className="text-primary hover:underline underline-offset-2">
                  @{pr.author}
                </a>
              ) : (
                <span>@{pr.author}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onViewGitHub && (
            <Button variant="secondary" size="sm" onClick={onViewGitHub}>
              <ExternalLink className="size-4" />
              View on GitHub
            </Button>
          )}
          {onRerunAnalysis && (
            <Button variant="secondary" size="sm" onClick={onRerunAnalysis}>
              <RefreshCw className="size-4" />
              Re-run
            </Button>
          )}
          {onFixIssues && (
            <Button
              variant="primary"
              size="sm"
              onClick={onFixIssues}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              Fix Issues
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3',
          'rounded-lg border',
          config.bg,
          config.border,
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center size-8 rounded-full',
              status === 'passing' && 'bg-success text-success-foreground',
              status === 'warning' && 'bg-warning text-warning-foreground',
              status === 'failing' && 'bg-destructive text-destructive-foreground',
              status === 'pending' && 'bg-muted-foreground text-background',
            )}
          >
            <StatusIcon className="size-4" />
          </div>
          <div>
            <div className={cn('font-medium capitalize', config.color)}>{status}</div>
            <div className="text-sm text-muted-foreground">{statusMessage}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Updated {updatedAt}</div>
      </div>
    </div>
  );
}
