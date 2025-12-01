'use client';

import * as React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';

type FileType = 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'tsx' | 'jsx' | 'js' | 'other';

// File type icon component
function FileTypeIcon({ type, className }: { type: FileType; className?: string }) {
  const iconClass = cn('size-4 font-mono text-xs font-bold flex items-center justify-center rounded-sm', className);

  switch (type) {
    case 'typescript':
    case 'tsx':
      return <span className={cn(iconClass, 'bg-icon-typescript/20 text-icon-typescript')}>TS</span>;
    case 'javascript':
    case 'jsx':
    case 'js':
      return <span className={cn(iconClass, 'bg-icon-javascript/20 text-icon-javascript')}>JS</span>;
    case 'html':
      return <span className={cn(iconClass, 'bg-icon-html/20 text-icon-html')}>H</span>;
    case 'css':
      return <span className={cn(iconClass, 'bg-icon-css/20 text-icon-css')}>C</span>;
    case 'json':
      return <span className={cn(iconClass, 'bg-muted text-muted-foreground')}>{'{}'}</span>;
    default:
      return <span className={cn(iconClass, 'bg-muted text-muted-foreground')}>F</span>;
  }
}

// Detect file type from extension
function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'json':
      return 'json';
    default:
      return 'other';
  }
}

function StackedChevrons({ isOpen, className }: { isOpen?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center -space-y-1 transition-opacity', className)}>
      <ChevronUp className={cn('size-3 transition-colors', isOpen ? 'text-foreground' : 'text-muted-foreground')} />
      <ChevronDown className={cn('size-3 transition-colors', isOpen ? 'text-foreground' : 'text-muted-foreground')} />
    </div>
  );
}

interface FileChangeRowTriggerProps {
  path: string;
  filename: string;
  additions?: number;
  deletions?: number;
  fileType?: FileType;
  isOpen?: boolean;
  className?: string;
}

function FileChangeRowTrigger({
  path,
  filename,
  additions,
  deletions,
  fileType,
  isOpen,
  className,
}: FileChangeRowTriggerProps) {
  const detectedType = fileType || getFileType(filename);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer',
        'hover:bg-accent',
        className,
      )}
    >
      <FileTypeIcon type={detectedType} />

      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className="text-muted-foreground text-sm truncate">{path}</span>
        <span className="text-foreground text-sm font-medium">{filename}</span>
      </div>

      <div className="flex items-center gap-2 text-sm shrink-0">
        {additions !== undefined && additions > 0 && <span className="text-success font-medium">+{additions}</span>}
        {deletions !== undefined && deletions > 0 && <span className="text-destructive font-medium">-{deletions}</span>}
      </div>

      <StackedChevrons isOpen={isOpen} />
    </div>
  );
}

interface FileChangeRowProps {
  path: string;
  filename: string;
  additions?: number;
  deletions?: number;
  fileType?: FileType;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function FileChangeRow({
  path,
  filename,
  additions,
  deletions,
  fileType,
  children,
  defaultOpen = false,
  className,
}: FileChangeRowProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <FileChangeRowTrigger
          path={path}
          filename={filename}
          additions={additions}
          deletions={deletions}
          fileType={fileType}
          isOpen={isOpen}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-3 bg-muted/30 border-t border-border">
          {children || (
            <div className="font-mono text-xs text-muted-foreground">
              {/* Default placeholder content - diff preview */}
              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-muted-foreground/60 select-none w-6 text-right">7</span>
                  <span className="text-success">
                    + import {'{'} createMemo, Match, show, Switch {'}'} from "solidjs/router"
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground/60 select-none w-6 text-right">8</span>
                  <span className="text-success">
                    + import {'{'} createMemo, Match, show, Switch {'}'} from "solidjs/router"
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground/60 select-none w-6 text-right">9</span>
                  <span className="text-destructive">
                    - import {'{'} oldFunction {'}'} from "legacy"
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FileChangeListProps {
  title?: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function FileChangeList({
  title = 'Changed files',
  count,
  children,
  defaultOpen = true,
  className,
}: FileChangeListProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors py-2"
        >
          <StackedChevrons isOpen={isOpen} />
          <span>{count !== undefined ? `${count} ${title}` : title}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-background border border-border rounded-lg overflow-hidden divide-y divide-border mt-2">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export {
  FileChangeRow,
  FileChangeRowTrigger,
  FileChangeList,
  FileTypeIcon,
  getFileType,
  StackedChevrons,
  type FileType,
  type FileChangeRowProps,
  type FileChangeRowTriggerProps,
  type FileChangeListProps,
};
