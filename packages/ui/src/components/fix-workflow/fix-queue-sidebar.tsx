'use client';

import { Check, ChevronDown, Circle, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import type { DecisionStatus, FixQueueSidebarProps, QueueItem } from './types';

function StatusIcon({ status, isActive }: { status: DecisionStatus; isActive: boolean }) {
  const baseClass = 'size-4 shrink-0';

  if (isActive) {
    return (
      <div
        className={cn(
          baseClass,
          'rounded-full bg-warning text-warning-foreground',
          'flex items-center justify-center',
        )}
      >
        <Circle className="size-2 fill-current" />
      </div>
    );
  }

  switch (status) {
    case 'accepted':
      return (
        <div
          className={cn(
            baseClass,
            'rounded-full bg-success text-success-foreground',
            'flex items-center justify-center',
          )}
        >
          <Check className="size-3" strokeWidth={3} />
        </div>
      );
    case 'rejected':
      return (
        <div
          className={cn(
            baseClass,
            'rounded-full border-2 border-destructive text-destructive',
            'flex items-center justify-center',
          )}
        >
          <X className="size-3" strokeWidth={3} />
        </div>
      );
    case 'skipped':
      return (
        <div
          className={cn(
            baseClass,
            'rounded-full border-2 border-muted-foreground text-muted-foreground',
            'flex items-center justify-center text-[10px] font-bold',
          )}
        >
          ~
        </div>
      );
    default:
      return (
        <div className={cn(baseClass, 'rounded-full border-2 border-border bg-transparent')} />
      );
  }
}

function QueueItemRow({
  item,
  onClick,
}: {
  item: QueueItem & { index: number };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md',
        'text-sm text-left transition-colors',
        'hover:bg-accent/50',
        item.isActive && 'bg-accent border border-border',
        !item.isActive && item.status === 'pending' && 'text-muted-foreground',
        item.status === 'accepted' && 'text-success',
        item.status === 'rejected' && 'text-destructive line-through opacity-60',
        item.status === 'skipped' && 'text-muted-foreground opacity-60',
      )}
    >
      <StatusIcon status={item.status} isActive={item.isActive} />
      <span className="font-mono text-xs truncate flex-1">{item.issue.type}</span>
    </button>
  );
}

function PriorityGroup({
  label,
  items,
  onItemClick,
  defaultOpen = true,
}: {
  label: string;
  items: Array<QueueItem & { index: number }>;
  onItemClick: (index: number) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  const acceptedCount = items.filter((i) => i.status === 'accepted').length;
  const _hasActive = items.some((i) => i.isActive);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2',
            'text-xs font-medium text-muted-foreground',
            'hover:text-foreground transition-colors',
          )}
        >
          <ChevronDown className={cn('size-3 transition-transform', !isOpen && '-rotate-90')} />
          <span className="flex-1 text-left">{label}</span>
          <span className="tabular-nums">
            ({acceptedCount}/{items.length})
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 px-1">
          {items.map((item) => (
            <QueueItemRow key={item.issue.id} item={item} onClick={() => onItemClick(item.index)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FixQueueSidebar({
  groups,
  onItemClick,
  acceptedCount,
  remainingCount,
  onAcceptAllAutoFixable,
  onCreatePR,
  isCreatingPR,
}: FixQueueSidebarProps) {
  // Add index to each item
  let globalIndex = 0;
  const groupsWithIndex = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      index: globalIndex++,
    })),
  }));

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fix Queue
        </h2>
        <p className="mt-1 text-sm text-foreground">
          {remainingCount} remaining · {acceptedCount} accepted
        </p>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto py-2">
        {groupsWithIndex.map((group) => (
          <PriorityGroup
            key={group.priority}
            label={`${group.label} (${group.items.length})`}
            items={group.items}
            onItemClick={onItemClick}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-border space-y-2">
        {onAcceptAllAutoFixable && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAcceptAllAutoFixable}
            className="w-full justify-center"
          >
            Accept All Auto-Fixable
          </Button>
        )}

        {onCreatePR && (
          <Button
            variant="primary"
            size="sm"
            onClick={onCreatePR}
            disabled={acceptedCount === 0 || isCreatingPR}
            className={cn(
              'w-full justify-center',
              'bg-success hover:bg-success/90 text-success-foreground',
            )}
            isLoading={isCreatingPR}
          >
            {isCreatingPR ? (
              'Creating PR...'
            ) : (
              <>
                Create PR with {acceptedCount} Fix{acceptedCount !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
