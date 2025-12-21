'use client';

import { ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import type { DocsImpactFile } from './types';

interface DocsImpactCardProps {
  file: DocsImpactFile;
  defaultOpen?: boolean;
  onOpenFile?: () => void;
  onGenerateUpdates?: () => void;
  className?: string;
}

export function DocsImpactCard({
  file,
  defaultOpen = true,
  onOpenFile,
  onGenerateUpdates,
  className,
}: DocsImpactCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-between w-full px-4 py-3',
              'bg-muted/50 hover:bg-muted/70 transition-colors',
              'cursor-pointer text-left',
            )}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="size-4 text-muted-foreground" />
              <span className="font-mono text-sm">{file.path}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {file.issues.length} {file.issues.length === 1 ? 'issue' : 'issues'}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Issues */}
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {file.issues.map((issue) => (
              <div key={`${issue.line}-${issue.description}`} className="px-4 py-3">
                <div className="font-mono text-[11px] text-muted-foreground mb-1">
                  Line {issue.line}
                </div>
                <div className="text-sm text-foreground mb-2">{issue.description}</div>

                {(issue.before || issue.after) && (
                  <div className="font-mono text-xs bg-muted/50 rounded p-2.5 space-y-0.5">
                    {issue.before && (
                      <div className="text-destructive">
                        <span className="select-none">- </span>
                        {issue.before}
                      </div>
                    )}
                    {issue.after && (
                      <div className="text-success">
                        <span className="select-none">+ </span>
                        {issue.after}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          {(onOpenFile || onGenerateUpdates) && (
            <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
              {onOpenFile && (
                <Button variant="secondary" size="sm" onClick={onOpenFile}>
                  <ExternalLink className="size-3.5" />
                  Open File
                </Button>
              )}
              {onGenerateUpdates && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onGenerateUpdates}
                  className="bg-primary hover:bg-primary/90"
                >
                  Generate Updates
                </Button>
              )}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface DocsImpactSectionProps {
  files: DocsImpactFile[];
  onOpenFile?: (path: string) => void;
  onGenerateUpdates?: (path: string) => void;
  className?: string;
}

export function DocsImpactSection({
  files,
  onOpenFile,
  onGenerateUpdates,
  className,
}: DocsImpactSectionProps) {
  if (files.length === 0) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        <FileText className="size-8 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No external docs affected by this PR</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {files.map((file, index) => (
        <DocsImpactCard
          key={file.path}
          file={file}
          defaultOpen={index === 0}
          onOpenFile={onOpenFile ? () => onOpenFile(file.path) : undefined}
          onGenerateUpdates={onGenerateUpdates ? () => onGenerateUpdates(file.path) : undefined}
        />
      ))}
    </div>
  );
}
