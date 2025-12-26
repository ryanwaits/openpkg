'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TerminalLine {
  type: 'command' | 'status' | 'log' | 'error' | 'success';
  text: string;
  step?: string;
}

interface TerminalOutputProps {
  lines: TerminalLine[];
  isRunning: boolean;
}

const stepIcons: Record<string, string> = {
  npm: '\u{1F4E6}',
  plan: '\u{1F4DD}',
  build: '\u{1F528}',
  analyze: '\u{1F50D}',
  complete: '\u{2705}',
};

export function TerminalOutput({ lines, isRunning }: TerminalOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="mt-6 rounded-lg overflow-hidden border border-border shadow-lg">
      {/* macOS-style header */}
      <div className="h-9 bg-muted/80 flex items-center px-4 gap-2 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-red-400/60" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
        <div className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-4 text-xs text-muted-foreground font-mono">doccov</span>
      </div>

      {/* Terminal content */}
      <div className="bg-[#0d1117] p-4 font-mono text-sm max-h-72 overflow-y-auto min-h-[120px]">
        {lines.map((line, i) => (
          <div
            key={`${line.type}-${line.text.slice(0, 20)}-${i}`}
            className={cn(
              'leading-relaxed py-0.5',
              line.type === 'command' && 'text-green-400',
              line.type === 'status' && 'text-blue-400',
              line.type === 'log' && 'text-gray-400',
              line.type === 'error' && 'text-red-400',
              line.type === 'success' && 'text-green-400',
            )}
          >
            {line.step && stepIcons[line.step] && (
              <span className="mr-2">{stepIcons[line.step]}</span>
            )}
            {line.type === 'command' && <span className="text-gray-500 mr-2">$</span>}
            {line.text}
          </div>
        ))}

        {isRunning && (
          <div className="text-blue-400 mt-1">
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
