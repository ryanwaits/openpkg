'use client';

import Link from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { CommandMenu } from './command-menu';
import { OrgSwitcher } from './org-switcher';
import { SidebarFooterNav } from './sidebar-footer-nav';
import { SidebarPackages } from './sidebar-packages';
import { SidebarSearch } from './sidebar-search';

export function Sidebar() {
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col w-64 h-full shrink-0',
        'border-r border-sidebar-border',
        'bg-sidebar text-sidebar-foreground',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13h6" />
            <path d="M9 17h3" />
            <path d="M9 9h1" />
          </svg>
          DocCov
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <SidebarSearch onOpen={() => setCommandOpen(true)} />
      </div>

      {/* Command Menu */}
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Packages List - Scrollable */}
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarPackages />
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="mt-auto">
        {/* Settings, API Keys, Documentation links */}
        <SidebarFooterNav />

        {/* Org Switcher - with top border */}
        <div className="border-t border-sidebar-border">
          <OrgSwitcher />
        </div>
      </div>
    </aside>
  );
}
