'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import { CodeIcon } from '../docskit/code.icon';
import { ExportRow } from './export-row';
import type { FileChange } from './types';

interface FileSectionProps {
  file: FileChange;
  defaultOpen?: boolean;
  className?: string;
}

function getLangFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
  };
  return extMap[ext] || ext;
}

export function FileSection({ file, defaultOpen = true, className }: FileSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const lang = getLangFromFilename(file.filename);

  const statsText = [];
  if (file.stats.added && file.stats.added > 0) {
    statsText.push(
      <span key="added" className="text-success">
        +{file.stats.added} {file.stats.added === 1 ? 'export' : 'exports'}
      </span>,
    );
  }
  if (file.stats.modified && file.stats.modified > 0) {
    statsText.push(
      <span key="modified" className="text-blue-500">
        ~{file.stats.modified} modified
      </span>,
    );
  }
  if (file.stats.removed && file.stats.removed > 0) {
    statsText.push(
      <span key="removed" className="text-destructive">
        -{file.stats.removed} removed
      </span>,
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-between w-full px-4 py-3',
              'bg-muted/50 hover:bg-muted/70 transition-colors',
              'cursor-pointer text-left',
              isOpen && 'border-b border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <div className="size-4 shrink-0 opacity-60">
                <CodeIcon title={file.filename} lang={lang} />
              </div>
              <span className="font-mono text-sm text-muted-foreground">{file.path}</span>
              <span className="font-mono text-sm font-medium">{file.filename}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">{statsText}</div>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div>
            {file.exports.map((exp, index) => (
              <ExportRow key={`${exp.name}-${index}`} export={exp} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
