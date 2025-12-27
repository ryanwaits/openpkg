'use client';

import { cn } from '@doccov/ui/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface CodeTab {
  /** Tab label */
  label: string;
  /** Tab content (code block) */
  content: ReactNode;
  /** Raw code for copy button */
  code: string;
}

export interface CodeTabsProps {
  /** Array of tabs */
  tabs: CodeTab[];
  /** Default selected tab index */
  defaultIndex?: number;
  /** Custom className */
  className?: string;
}

/**
 * Tabbed code block wrapper with copy button per tab.
 * Integrates with any code rendering component.
 */
export function CodeTabs({
  tabs,
  defaultIndex = 0,
  className,
}: CodeTabsProps): React.ReactNode {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [copied, setCopied] = useState(false);

  const activeTab = tabs[activeIndex];

  const handleCopy = () => {
    if (!activeTab) return;
    navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!tabs.length) return null;

  return (
    <div
      className={cn(
        'group rounded-lg border border-border overflow-hidden',
        className,
      )}
    >
      {/* Tab list */}
      <div className="flex items-center border-b border-border bg-muted/30">
        <div className="flex-1 flex items-stretch">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'px-4 py-2 text-sm font-mono transition-colors',
                'border-r border-border last:border-r-0',
                index === activeIndex
                  ? 'text-foreground bg-background/50'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'p-2 mx-2',
            'text-muted-foreground hover:text-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'cursor-pointer',
          )}
          aria-label="Copy code"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {/* Tab content */}
      <div className="bg-background">{activeTab?.content}</div>
    </div>
  );
}
