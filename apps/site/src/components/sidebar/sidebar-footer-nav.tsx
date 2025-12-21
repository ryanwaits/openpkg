'use client';

import { ExternalLink, Key, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const footerNavItems = [
  { href: '/settings', label: 'Settings', icon: Settings, exact: true },
  { href: '/settings/api-keys', label: 'API Keys', icon: Key },
];

export function SidebarFooterNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 py-2 space-y-0.5">
      {footerNavItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
              'transition-colors duration-150',
              isActive
                ? 'bg-sidebar-accent text-sidebar-foreground'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
            )}
          >
            <Icon className="size-4" strokeWidth={1.5} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Documentation link (external) */}
      <a
        href="https://doccov.dev/docs"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
          'transition-colors duration-150',
          'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
        )}
      >
        <ExternalLink className="size-4" strokeWidth={1.5} />
        <span>Documentation</span>
      </a>
    </nav>
  );
}
