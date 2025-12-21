'use client';

import { ExternalLink, Key, Laptop, LayoutDashboard, Moon, Settings, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings/api-keys'))}>
            <Key className="mr-2" />
            <span>API Keys</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Links">
          <CommandItem
            onSelect={() => runCommand(() => window.open('https://doccov.dev/docs', '_blank'))}
          >
            <ExternalLink className="mr-2" />
            <span>Documentation</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              })
            }
          >
            <Sun className="mr-2" />
            <span>Light</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.documentElement.classList.remove('light');
                document.documentElement.classList.add('dark');
              })
            }
          >
            <Moon className="mr-2" />
            <span>Dark</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.documentElement.classList.remove('light', 'dark');
              })
            }
          >
            <Laptop className="mr-2" />
            <span>System</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
