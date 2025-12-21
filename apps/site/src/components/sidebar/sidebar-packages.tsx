'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Mock data - will be replaced with real data from API
const mockPackages = [
  { slug: 'zod-openapi', name: 'zod-openapi', documented: 156, total: 200 },
  { slug: 'doccov-cli', name: '@doccov/cli', documented: 46, total: 50 },
  { slug: 'footnote', name: 'footnote', documented: 9, total: 20 },
];

export function SidebarPackages() {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Packages
        </span>
        <button
          type="button"
          className={cn(
            'flex items-center justify-center size-5 rounded',
            'text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            'transition-colors duration-150',
          )}
          title="Add package"
        >
          <Plus className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Package List */}
      <nav className="space-y-0.5">
        {mockPackages.map((pkg) => {
          const isActive =
            pathname === `/packages/${pkg.slug}` || pathname.startsWith(`/packages/${pkg.slug}/`);

          return (
            <Link
              key={pkg.slug}
              href={`/packages/${pkg.slug}`}
              className={cn(
                'group flex items-center justify-between gap-2 px-3 py-2 rounded-lg',
                'transition-all duration-150 ease-out',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Package
                  className={cn(
                    'size-4 shrink-0',
                    isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/40',
                  )}
                  strokeWidth={1.5}
                />
                <span className="text-sm font-medium truncate">{pkg.name}</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-sidebar-foreground/50">
                {pkg.documented}/{pkg.total}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Empty State */}
      {mockPackages.length === 0 && (
        <div className="px-3 py-6 text-center">
          <Package className="size-8 mx-auto text-sidebar-foreground/20 mb-2" strokeWidth={1} />
          <p className="text-sm text-sidebar-foreground/50">No packages yet</p>
          <button type="button" className="mt-2 text-sm text-sidebar-primary hover:underline">
            Add your first package
          </button>
        </div>
      )}
    </div>
  );
}
