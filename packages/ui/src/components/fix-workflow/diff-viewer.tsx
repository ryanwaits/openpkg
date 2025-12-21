'use client';

import { type HighlightedCode, highlight, Pre } from 'codehike/code';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { theme } from '../docskit/code.config';
import type { DiffViewerProps } from './types';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: { before?: number; after?: number };
}

function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: DiffLine[] = [];

  // Simple diff algorithm - compare line by line
  let beforeIdx = 0;
  let afterIdx = 0;
  let beforeLineNum = 1;
  let afterLineNum = 1;

  while (beforeIdx < beforeLines.length || afterIdx < afterLines.length) {
    const beforeLine = beforeLines[beforeIdx];
    const afterLine = afterLines[afterIdx];

    if (beforeIdx >= beforeLines.length) {
      // Only after lines left - all additions
      result.push({
        type: 'added',
        content: afterLine,
        lineNumber: { after: afterLineNum++ },
      });
      afterIdx++;
    } else if (afterIdx >= afterLines.length) {
      // Only before lines left - all removals
      result.push({
        type: 'removed',
        content: beforeLine,
        lineNumber: { before: beforeLineNum++ },
      });
      beforeIdx++;
    } else if (beforeLine === afterLine) {
      // Lines match
      result.push({
        type: 'unchanged',
        content: beforeLine,
        lineNumber: { before: beforeLineNum++, after: afterLineNum++ },
      });
      beforeIdx++;
      afterIdx++;
    } else {
      // Lines differ - look ahead to find if it's a change or add/remove
      const nextBeforeMatch = afterLines.slice(afterIdx).indexOf(beforeLine);
      const nextAfterMatch = beforeLines.slice(beforeIdx).indexOf(afterLine);

      if (nextBeforeMatch === -1 && nextAfterMatch === -1) {
        // Both lines are unique - show as removal then addition
        result.push({
          type: 'removed',
          content: beforeLine,
          lineNumber: { before: beforeLineNum++ },
        });
        result.push({
          type: 'added',
          content: afterLine,
          lineNumber: { after: afterLineNum++ },
        });
        beforeIdx++;
        afterIdx++;
      } else if (
        nextBeforeMatch !== -1 &&
        (nextAfterMatch === -1 || nextBeforeMatch <= nextAfterMatch)
      ) {
        // afterLine appears later in before - this is an addition
        result.push({
          type: 'added',
          content: afterLine,
          lineNumber: { after: afterLineNum++ },
        });
        afterIdx++;
      } else {
        // beforeLine appears later in after - this is a removal
        result.push({
          type: 'removed',
          content: beforeLine,
          lineNumber: { before: beforeLineNum++ },
        });
        beforeIdx++;
      }
    }
  }

  return result;
}

function DiffPane({
  code,
  label,
  type,
  className,
}: {
  code: string;
  label: string;
  type: 'before' | 'after';
  className?: string;
}) {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    highlight({ value: code, lang: 'typescript', meta: '' }, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const { background: _bg, ...style } = highlighted?.style ?? {};

  return (
    <div className={cn('flex flex-col min-w-0', className)}>
      {/* Header */}
      <div
        className={cn(
          'px-3 py-2 text-xs font-medium uppercase tracking-wide',
          'bg-muted/50 border-b border-border',
          'flex items-center gap-2',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center justify-center size-4 rounded text-xs font-bold',
            type === 'before' ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success',
          )}
        >
          {type === 'before' ? '−' : '+'}
        </span>
        <span className="text-muted-foreground">{label}</span>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto bg-dk-background">
        {highlighted ? (
          <Pre
            code={highlighted}
            className="p-3 m-0 text-sm font-mono leading-relaxed !bg-transparent"
            style={style}
          />
        ) : (
          <div className="p-3 text-sm font-mono text-muted-foreground animate-pulse">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}

function UnifiedDiffView({
  before,
  after,
  language,
}: {
  before: string;
  after: string;
  language: string;
}) {
  const diffLines = computeDiff(before, after);
  const [_highlightedBefore, setHighlightedBefore] = useState<HighlightedCode | null>(null);
  const [_highlightedAfter, setHighlightedAfter] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      highlight({ value: before, lang: language || 'typescript', meta: '' }, theme),
      highlight({ value: after, lang: language || 'typescript', meta: '' }, theme),
    ]).then(([beforeResult, afterResult]) => {
      if (!cancelled) {
        setHighlightedBefore(beforeResult);
        setHighlightedAfter(afterResult);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [before, after, language]);

  return (
    <div className="overflow-auto bg-dk-background">
      <div className="p-3 font-mono text-sm leading-relaxed">
        {diffLines.map((line) => (
          <div
            key={`${line.type}-${line.lineNumber.before ?? 'n'}-${line.lineNumber.after ?? 'n'}`}
            className={cn(
              'flex',
              line.type === 'removed' && 'bg-destructive/10 text-destructive',
              line.type === 'added' && 'bg-success/10 text-success',
            )}
          >
            {/* Line numbers */}
            <div className="w-8 shrink-0 text-right pr-2 text-muted-foreground select-none">
              {line.lineNumber.before ?? ' '}
            </div>
            <div className="w-8 shrink-0 text-right pr-2 text-muted-foreground select-none">
              {line.lineNumber.after ?? ' '}
            </div>

            {/* Symbol */}
            <div className="w-4 shrink-0 text-center select-none">
              {line.type === 'removed' && '−'}
              {line.type === 'added' && '+'}
              {line.type === 'unchanged' && ' '}
            </div>

            {/* Content */}
            <div className="flex-1 whitespace-pre">{line.content || ' '}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiffViewer({ before, after, language, mode, className }: DiffViewerProps) {
  if (mode === 'unified') {
    return (
      <div className={cn('border border-border rounded overflow-hidden', className)}>
        <UnifiedDiffView before={before} after={after} language={language} />
      </div>
    );
  }

  // Split view (default)
  return (
    <div className={cn('grid grid-cols-2 border border-border rounded overflow-hidden', className)}>
      <DiffPane code={before} label="Before" type="before" className="border-r border-border" />
      <DiffPane code={after} label="After (Fixed)" type="after" />
    </div>
  );
}
