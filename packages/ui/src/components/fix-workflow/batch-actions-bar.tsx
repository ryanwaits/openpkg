'use client';

import { Check, Copy, ExternalLink, FileCode, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import type { BatchActionsBarProps } from './types';

export function BatchActionsBar({
  acceptedCount,
  onClearSelection,
  onCreatePR,
  isCreatingPR,
}: BatchActionsBarProps) {
  if (acceptedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-card border border-border rounded-lg shadow-lg',
        'px-4 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
      )}
    >
      {/* Count */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center justify-center size-6 rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" strokeWidth={3} />
        </div>
        <span className="font-medium">
          {acceptedCount} fix{acceptedCount !== 1 ? 'es' : ''} accepted
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
          Clear
        </Button>

        <Button variant="secondary" size="sm">
          <FileCode className="size-4" />
          Apply to Files
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onCreatePR}
          disabled={isCreatingPR}
          isLoading={isCreatingPR}
          className="bg-success hover:bg-success/90 text-success-foreground"
        >
          <ExternalLink className="size-4" />
          Create PR
        </Button>

        <Button variant="secondary" size="sm">
          <Copy className="size-4" />
          Copy as Patch
        </Button>
      </div>
    </div>
  );
}
