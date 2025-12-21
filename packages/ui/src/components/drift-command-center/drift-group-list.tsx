'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import { DriftCommandCard } from './drift-command-card';
import type { DriftIssue, DriftSeverity } from './types';

interface DriftGroupListProps {
  issues: DriftIssue[];
  onViewIssue?: (issue: DriftIssue) => void;
  onFixIssue?: (issue: DriftIssue) => void;
  onIgnoreIssue?: (issue: DriftIssue) => void;
  className?: string;
}

const severityOrder: DriftSeverity[] = ['high', 'medium', 'low'];

const severityConfig: Record<DriftSeverity, { label: string; dotClass: string }> = {
  high: { label: 'High Priority', dotClass: 'bg-destructive' },
  medium: { label: 'Medium Priority', dotClass: 'bg-warning' },
  low: { label: 'Low Priority', dotClass: 'bg-muted-foreground' },
};

export function DriftGroupList({
  issues,
  onViewIssue,
  onFixIssue,
  onIgnoreIssue,
  className,
}: DriftGroupListProps) {
  // Group issues by severity
  const grouped = severityOrder.reduce(
    (acc, severity) => {
      acc[severity] = issues.filter((i) => i.severity === severity);
      return acc;
    },
    {} as Record<DriftSeverity, DriftIssue[]>,
  );

  // Track open state per severity
  const [openSections, setOpenSections] = useState<Record<DriftSeverity, boolean>>({
    high: true,
    medium: true,
    low: false,
  });

  const toggleSection = (severity: DriftSeverity) => {
    setOpenSections((prev) => ({ ...prev, [severity]: !prev[severity] }));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {severityOrder.map((severity) => {
        const items = grouped[severity];
        if (items.length === 0) return null;

        const config = severityConfig[severity];
        const isOpen = openSections[severity];

        return (
          <Collapsible key={severity} open={isOpen} onOpenChange={() => toggleSection(severity)}>
            {/* Section Header */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 py-2 px-1 text-left',
                  'hover:bg-accent/30 rounded transition-colors',
                )}
              >
                {isOpen ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
                <span className={cn('size-2 rounded-full', config.dotClass)} />
                <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {config.label}
                </span>
                <span className="text-sm text-muted-foreground">({items.length})</span>
              </button>
            </CollapsibleTrigger>

            {/* Issue Cards */}
            <CollapsibleContent>
              <div className="space-y-3 mt-2 ml-6">
                {items.map((issue) => (
                  <DriftCommandCard
                    key={issue.id}
                    issue={issue}
                    onView={onViewIssue ? () => onViewIssue(issue) : undefined}
                    onFix={onFixIssue ? () => onFixIssue(issue) : undefined}
                    onIgnore={onIgnoreIssue ? () => onIgnoreIssue(issue) : undefined}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {issues.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No drift issues found</p>
        </div>
      )}
    </div>
  );
}
