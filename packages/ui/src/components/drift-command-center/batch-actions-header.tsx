'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';

interface BatchActionsHeaderProps {
  packageName: string;
  totalIssues: number;
  autoFixableCount: number;
  onFixAllAutoFixable?: () => void;
  className?: string;
}

export function BatchActionsHeader({
  packageName,
  totalIssues,
  autoFixableCount,
  onFixAllAutoFixable,
  className,
}: BatchActionsHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {/* Title and subtitle */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Drift Overview</h1>
        <p className="text-sm text-muted-foreground">
          {totalIssues} issue{totalIssues !== 1 ? 's' : ''} in{' '}
          <code className="font-mono text-foreground">{packageName}</code>
        </p>
      </div>

      {/* Batch action button */}
      {autoFixableCount > 0 && onFixAllAutoFixable && (
        <Button
          variant="primary"
          size="sm"
          onClick={onFixAllAutoFixable}
          className="bg-success hover:bg-success/90 text-success-foreground"
        >
          <Sparkles className="size-4" />
          Fix All Auto-Fixable ({autoFixableCount})
        </Button>
      )}
    </div>
  );
}
