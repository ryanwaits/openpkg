'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSearchProps {
  onOpen?: () => void;
}

export function SidebarSearch({ onOpen }: SidebarSearchProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex items-center w-full gap-3 px-3 py-2 rounded-lg',
        'text-sm text-sidebar-foreground/50',
        'bg-sidebar-accent/30 hover:bg-sidebar-accent/60',
        'border border-sidebar-border/50',
        'transition-all duration-150 ease-out',
        'hover:border-sidebar-border',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search...</span>
      <kbd
        className={cn(
          'hidden sm:inline-flex items-center gap-0.5',
          'h-5 px-1.5 rounded',
          'bg-sidebar-accent/50 border border-sidebar-border/50',
          'font-mono text-[10px] font-medium text-sidebar-foreground/40',
        )}
      >
        <span className="text-xs">&#8984;</span>K
      </kbd>
    </button>
  );
}
