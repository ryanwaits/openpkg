'use client';

import { Check, ChevronsUpDown, LogOut, Plus, Settings, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

function getPlanBadgeStyles(plan: string) {
  switch (plan) {
    case 'pro':
      return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
    case 'team':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'enterprise':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    default:
      return 'bg-sidebar-accent text-sidebar-foreground/60 border-sidebar-border';
  }
}

export function OrgSwitcher() {
  const { user, organizations, currentOrg, setCurrentOrg, signOut, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-3">
        <div className="h-14 rounded-lg bg-sidebar-accent/30 animate-pulse" />
      </div>
    );
  }

  if (!currentOrg || !user) {
    // Show sign-in prompt when not authenticated
    return (
      <div className="p-3">
        <a
          href="/login"
          className={cn(
            'flex items-center gap-3 w-full p-3',
            'rounded-lg',
            'bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors duration-150',
            'text-sm font-medium text-sidebar-foreground',
          )}
        >
          <div className="size-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
            <LogOut className="size-4 text-sidebar-foreground/60 rotate-180" />
          </div>
          <span>Sign in</span>
        </a>
      </div>
    );
  }

  const initials = currentOrg.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-3 w-full p-3',
            'rounded-lg mx-0',
            'hover:bg-sidebar-accent/50 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset',
          )}
        >
          <Avatar className="size-9 rounded-lg">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate text-sidebar-foreground">
                {currentOrg.name}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border',
                  getPlanBadgeStyles(currentOrg.plan),
                )}
              >
                {currentOrg.plan === 'pro' && <Sparkles className="size-2.5 mr-0.5" />}
                {currentOrg.plan}
              </span>
            </div>
            <span className="text-xs text-sidebar-foreground/50 truncate block">{user.email}</span>
          </div>
          <ChevronsUpDown className="size-4 text-sidebar-foreground/40 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[--radix-dropdown-menu-trigger-width] min-w-[240px]"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Organizations
        </DropdownMenuLabel>

        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrg(org.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Avatar className="size-6 rounded-md">
              <AvatarFallback className="rounded-md text-[10px] font-medium">
                {org.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrg.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-pointer" disabled>
          <Plus className="size-4" />
          New Organization
          <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer">
          <a href="/settings">
            <Settings className="size-4" />
            Account Settings
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut()}
          variant="destructive"
          className="cursor-pointer"
        >
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
