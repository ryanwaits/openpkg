'use client';

import { FileCode, Plus, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KindBadge } from '../badge';
import { Button } from '../button';
import type { ExportItem, ExportKind } from './types';

interface UndocumentedExport extends ExportItem {
  filePath: string;
  signature?: string;
}

interface UndocumentedCardProps {
  export: UndocumentedExport;
  onViewSource?: () => void;
  onAddDocs?: () => void;
  className?: string;
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

export function UndocumentedCard({
  export: exp,
  onViewSource,
  onAddDocs,
  className,
}: UndocumentedCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm font-medium">
            {exp.signature || exp.name}
            {exp.kind === 'function' && !exp.signature && '()'}
          </span>
          <KindBadge kind={kindMap[exp.kind]} size="sm" />
        </div>
      </div>

      {/* Location */}
      <div className="font-mono text-xs text-muted-foreground mb-3">
        <a href={`#${exp.filePath}`} className="text-primary hover:underline underline-offset-2">
          {exp.filePath}
        </a>
        {exp.line && <>:{exp.line}</>}
      </div>

      {/* Missing signals */}
      {exp.missing && exp.missing.length > 0 && (
        <div className="text-sm text-muted-foreground mb-4">
          <span className="text-warning">Missing:</span> {exp.missing.join(', ')}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onViewSource && (
          <Button variant="secondary" size="sm" onClick={onViewSource}>
            <FileCode className="size-3.5" />
            View Source
          </Button>
        )}
        {onAddDocs && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddDocs}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            <Plus className="size-3.5" />
            Add Documentation
          </Button>
        )}
      </div>
    </div>
  );
}

interface UndocumentedSectionProps {
  exports: UndocumentedExport[];
  onViewSource?: (exp: UndocumentedExport) => void;
  onAddDocs?: (exp: UndocumentedExport) => void;
  onGenerateAll?: () => void;
  className?: string;
}

export function UndocumentedSection({
  exports,
  onViewSource,
  onAddDocs,
  onGenerateAll,
  className,
}: UndocumentedSectionProps) {
  if (exports.length === 0) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        <Sparkles className="size-8 mx-auto mb-3 text-success" />
        <p className="font-medium">All exports are documented!</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Undocumented Exports ({exports.length})
        </div>
        {onGenerateAll && exports.length > 1 && (
          <Button variant="secondary" size="sm" onClick={onGenerateAll}>
            <Sparkles className="size-3.5" />
            Generate Docs (AI)
          </Button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {exports.map((exp, index) => (
          <UndocumentedCard
            key={`${exp.filePath}-${exp.name}-${index}`}
            export={exp}
            onViewSource={onViewSource ? () => onViewSource(exp) : undefined}
            onAddDocs={onAddDocs ? () => onAddDocs(exp) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export type { UndocumentedExport };
