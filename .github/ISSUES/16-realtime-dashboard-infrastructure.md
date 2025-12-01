# Issue #16: Real-Time Dashboard Infrastructure

**Priority**: P1 (Foundation for SaaS)
**Effort**: Large (4-5 weeks)
**Dependencies**: None (greenfield)

## Overview

Build a Linear-style, keyboard-first dashboard with blazingly fast UI through:

1. **TanStack Query + SSE** - Optimistic updates, real-time cache invalidation
2. **Keyboard navigation** - Command palette (Cmd+K), vim-style navigation (j/k)
3. **Trigger.dev + Supabase** - Background job processing, PostgreSQL persistence

### Design Philosophy

> **Compute once, read many. Never compute on the critical path.**

| Pattern | Implementation |
|---------|---------------|
| Optimistic updates | UI updates before server confirms |
| Background jobs | Heavy work runs async, results cached |
| Real-time sync | SSE for jobs, Supabase Realtime for data |
| Keyboard-first | Every action has a shortcut |

### Real-World Examples

- **Linear** - Local-first sync, optimistic mutations, keyboard everything
- **Raycast** - Pre-indexed search, instant results
- **Vercel** - Build in background, dashboard reads from cache

---

## Part A: Data Layer (TanStack Query + SSE)

### A.1 Package Installation

```bash
bun add @tanstack/react-query @tanstack/react-query-devtools
```

### A.2 Query Provider

```tsx
// apps/site/src/lib/query/provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,        // Fresh for 30s
        gcTime: 5 * 60 * 1000,       // Keep in cache 5 min
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### A.3 Query Key Factory

Hierarchical keys enable granular cache invalidation:

```typescript
// apps/site/src/lib/query/keys.ts

export const repoKeys = {
  all: ['repos'] as const,
  lists: () => [...repoKeys.all, 'list'] as const,
  list: (filters: { org?: string }) => [...repoKeys.lists(), filters] as const,
  details: () => [...repoKeys.all, 'detail'] as const,
  detail: (repoId: string) => [...repoKeys.details(), repoId] as const,
  // Nested resources
  scans: (repoId: string) => [...repoKeys.detail(repoId), 'scans'] as const,
  coverage: (repoId: string) => [...repoKeys.detail(repoId), 'coverage'] as const,
  coverageHistory: (repoId: string, range: 'week' | 'month' | 'quarter') =>
    [...repoKeys.coverage(repoId), 'history', range] as const,
  exports: (repoId: string) => [...repoKeys.detail(repoId), 'exports'] as const,
  drift: (repoId: string) => [...repoKeys.detail(repoId), 'drift'] as const,
} as const;

export const scanKeys = {
  all: ['scans'] as const,
  detail: (scanId: string) => [...scanKeys.all, 'detail', scanId] as const,
  active: () => [...scanKeys.all, 'active'] as const,
} as const;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  activity: (limit?: number) => [...dashboardKeys.all, 'activity', { limit }] as const,
} as const;
```

### A.4 API Client

```typescript
// apps/site/src/lib/api/client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.message || response.statusText, response.status);
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const repoApi = {
  list: (filters?: { org?: string }) =>
    apiFetch<Repository[]>(`/repos?${new URLSearchParams(filters as any)}`),
  get: (repoId: string) =>
    apiFetch<Repository>(`/repos/${encodeURIComponent(repoId)}`),
  getDrift: (repoId: string) =>
    apiFetch<DriftItem[]>(`/repos/${encodeURIComponent(repoId)}/drift`),
  getCoverageHistory: (repoId: string, range: string) =>
    apiFetch<CoveragePoint[]>(`/repos/${encodeURIComponent(repoId)}/coverage/history?range=${range}`),
};

export const scanApi = {
  trigger: (params: { repoId: string; ref?: string }) =>
    apiFetch<{ scanId: string }>('/scans', { method: 'POST', body: JSON.stringify(params) }),
  get: (scanId: string) => apiFetch<ScanJob>(`/scans/${scanId}`),
};

export const driftApi = {
  dismiss: (repoId: string, driftId: string) =>
    apiFetch<void>(`/repos/${encodeURIComponent(repoId)}/drift/${driftId}/dismiss`, { method: 'POST' }),
};

// Types
export interface Repository {
  id: string;
  owner: string;
  name: string;
  coverage: number;
  lastScanAt: string | null;
  driftCount: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface DriftItem {
  id: string;
  exportName: string;
  type: string;
  issue: string;
  suggestion?: string;
  status: 'active' | 'dismissed' | 'snoozed';
}

export interface CoveragePoint {
  date: string;
  coverage: number;
  driftCount: number;
}
```

### A.5 Optimistic Mutations

```typescript
// apps/site/src/lib/query/hooks/use-drift.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repoKeys, dashboardKeys } from '../keys';
import { repoApi, driftApi, type DriftItem } from '@/lib/api/client';

export function useDrift(repoId: string) {
  return useQuery({
    queryKey: repoKeys.drift(repoId),
    queryFn: () => repoApi.getDrift(repoId),
    enabled: !!repoId,
  });
}

/**
 * Dismiss drift with optimistic update
 * UI immediately reflects dismissed state
 */
export function useDismissDrift(repoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ driftId }: { driftId: string }) =>
      driftApi.dismiss(repoId, driftId),

    onMutate: async ({ driftId }) => {
      await queryClient.cancelQueries({ queryKey: repoKeys.drift(repoId) });

      const previousDrift = queryClient.getQueryData<DriftItem[]>(
        repoKeys.drift(repoId)
      );

      // Optimistically update
      queryClient.setQueryData<DriftItem[]>(
        repoKeys.drift(repoId),
        (old) => old?.map((item) =>
          item.id === driftId ? { ...item, status: 'dismissed' as const } : item
        ) ?? []
      );

      // Update dashboard summary
      queryClient.setQueryData(dashboardKeys.summary(), (old: any) =>
        old ? { ...old, totalDrift: Math.max(0, old.totalDrift - 1) } : old
      );

      return { previousDrift };
    },

    onError: (err, { driftId }, context) => {
      if (context?.previousDrift) {
        queryClient.setQueryData(repoKeys.drift(repoId), context.previousDrift);
      }
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.drift(repoId) });
      queryClient.invalidateQueries({ queryKey: repoKeys.detail(repoId) });
    },
  });
}
```

### A.6 Trigger Scan with Optimistic Update

```typescript
// apps/site/src/lib/query/hooks/use-scans.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { repoKeys, scanKeys } from '../keys';
import { scanApi, type Repository } from '@/lib/api/client';

export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: scanApi.trigger,

    onMutate: async ({ repoId }) => {
      await queryClient.cancelQueries({ queryKey: repoKeys.detail(repoId) });

      const previousRepo = queryClient.getQueryData<Repository>(
        repoKeys.detail(repoId)
      );

      // Show pending indicator immediately
      if (previousRepo) {
        queryClient.setQueryData(repoKeys.detail(repoId), {
          ...previousRepo,
          _scanPending: true,
        });
      }

      return { previousRepo };
    },

    onError: (err, { repoId }, context) => {
      if (context?.previousRepo) {
        queryClient.setQueryData(repoKeys.detail(repoId), context.previousRepo);
      }
    },

    onSuccess: (data, { repoId }) => {
      // Add scan to cache
      queryClient.setQueryData(scanKeys.detail(data.scanId), {
        id: data.scanId,
        status: 'pending',
        repoId,
        createdAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: scanKeys.active() });
    },

    onSettled: (_, __, { repoId }) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.detail(repoId) });
    },
  });
}
```

### A.7 SSE Event Stream Hook

```typescript
// apps/site/src/lib/query/hooks/use-event-stream.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { repoKeys, scanKeys, dashboardKeys } from '../keys';

const SSE_URL = process.env.NEXT_PUBLIC_API_URL + '/events/stream';

type SSEEventType =
  | 'scan:started' | 'scan:progress' | 'scan:complete' | 'scan:failed'
  | 'drift:detected' | 'coverage:changed';

export function useEventStream() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  let reconnectAttempts = 0;

  const handleEvent = useCallback((eventType: SSEEventType, data: any) => {
    switch (eventType) {
      case 'scan:started':
        queryClient.setQueryData(
          scanKeys.detail(data.scanId),
          (old: any) => ({ ...old, status: 'running' })
        );
        queryClient.invalidateQueries({ queryKey: scanKeys.active() });
        break;

      case 'scan:progress':
        queryClient.setQueryData(
          scanKeys.detail(data.scanId),
          (old: any) => ({ ...old, progress: data.progress, phase: data.phase })
        );
        break;

      case 'scan:complete':
        // Cascade invalidation
        queryClient.invalidateQueries({ queryKey: scanKeys.detail(data.scanId) });
        queryClient.invalidateQueries({ queryKey: scanKeys.active() });
        queryClient.invalidateQueries({ queryKey: repoKeys.detail(data.repoId) });
        queryClient.invalidateQueries({ queryKey: repoKeys.coverage(data.repoId) });
        queryClient.invalidateQueries({ queryKey: repoKeys.drift(data.repoId) });
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
        break;

      case 'drift:detected':
        queryClient.invalidateQueries({ queryKey: repoKeys.drift(data.repoId) });
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
        break;

      case 'coverage:changed':
        queryClient.invalidateQueries({ queryKey: repoKeys.detail(data.repoId) });
        queryClient.invalidateQueries({ queryKey: repoKeys.coverage(data.repoId) });
        break;
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const eventSource = new EventSource(SSE_URL, { withCredentials: true });

    const eventTypes: SSEEventType[] = [
      'scan:started', 'scan:progress', 'scan:complete', 'scan:failed',
      'drift:detected', 'coverage:changed',
    ];

    eventTypes.forEach(type => {
      eventSource.addEventListener(type, (e: MessageEvent) => {
        handleEvent(type, JSON.parse(e.data));
      });
    });

    eventSource.onerror = () => {
      eventSource.close();
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      setTimeout(connect, delay);
      reconnectAttempts++;
    };

    eventSource.onopen = () => { reconnectAttempts = 0; };
    eventSourceRef.current = eventSource;
  }, [handleEvent]);

  useEffect(() => {
    connect();
    return () => eventSourceRef.current?.close();
  }, [connect]);
}

export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  useEventStream();
  return <>{children}</>;
}
```

### A.8 Server Component Prefetching

```tsx
// apps/site/src/app/(platform)/dashboard/page.tsx
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { dashboardApi, repoApi } from '@/lib/api/client';
import { dashboardKeys, repoKeys } from '@/lib/query/keys';
import { DashboardClient } from './client';

export default async function DashboardPage() {
  const queryClient = new QueryClient();

  // Prefetch on server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.summary(),
      queryFn: dashboardApi.getSummary,
    }),
    queryClient.prefetchQuery({
      queryKey: repoKeys.list({}),
      queryFn: () => repoApi.list(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
```

---

## Part B: Keyboard Navigation System

### B.1 Package Installation

```bash
bun add cmdk
```

### B.2 Keyboard Provider

```typescript
// packages/ui/src/hooks/use-keyboard-shortcuts.ts
'use client';

import * as React from 'react';

export type ShortcutScope = 'global' | 'page' | 'component';

export interface Shortcut {
  id: string;
  keys: string[];
  handler: () => void;
  scope: ShortcutScope;
  description: string;
  when?: () => boolean;
}

interface KeyboardContextValue {
  registerShortcut: (shortcut: Shortcut) => () => void;
  getActiveShortcuts: () => Shortcut[];
  isInputFocused: () => boolean;
}

const KeyboardContext = React.createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const shortcuts = React.useRef<Map<string, Shortcut>>(new Map());
  const keySequence = React.useRef<string[]>([]);
  const sequenceTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const isInputFocused = React.useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' ||
           (el as HTMLElement).isContentEditable;
  }, []);

  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (isInputFocused() && event.key !== 'Escape') return;

    const keyParts: string[] = [];
    if (event.metaKey) keyParts.push('Meta');
    if (event.ctrlKey) keyParts.push('Control');
    if (event.altKey) keyParts.push('Alt');
    if (event.shiftKey) keyParts.push('Shift');

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      keyParts.push(key);
    }

    // Handle key sequences (g+p, g+d, etc.)
    if (keyParts.length === 1 && keyParts[0].length === 1) {
      keySequence.current.push(keyParts[0]);
      if (sequenceTimeout.current) clearTimeout(sequenceTimeout.current);
      sequenceTimeout.current = setTimeout(() => { keySequence.current = []; }, 1000);
    }

    for (const shortcut of shortcuts.current.values()) {
      if (shortcut.when && !shortcut.when()) continue;

      const isExactMatch =
        shortcut.keys.length === keyParts.length &&
        shortcut.keys.every((k, i) => k.toLowerCase() === keyParts[i]?.toLowerCase());

      const isSequenceMatch =
        shortcut.keys.length === keySequence.current.length &&
        shortcut.keys.every((k, i) => k.toLowerCase() === keySequence.current[i]);

      if (isExactMatch || isSequenceMatch) {
        event.preventDefault();
        shortcut.handler();
        keySequence.current = [];
        break;
      }
    }
  }, [isInputFocused]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const registerShortcut = React.useCallback((shortcut: Shortcut) => {
    shortcuts.current.set(shortcut.id, shortcut);
    return () => shortcuts.current.delete(shortcut.id);
  }, []);

  const getActiveShortcuts = React.useCallback(() => {
    return Array.from(shortcuts.current.values());
  }, []);

  return (
    <KeyboardContext.Provider value={{ registerShortcut, getActiveShortcuts, isInputFocused }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = React.useContext(KeyboardContext);
  if (!context) throw new Error('useKeyboardShortcuts must be used within KeyboardProvider');
  return context;
}

export function useShortcut(
  keys: string[],
  handler: () => void,
  options: { id?: string; description?: string; scope?: ShortcutScope; enabled?: boolean } = {}
) {
  const { registerShortcut } = useKeyboardShortcuts();
  const { id = keys.join('+'), description = '', scope = 'component', enabled = true } = options;

  React.useEffect(() => {
    if (!enabled) return;
    return registerShortcut({ id, keys, handler, scope, description });
  }, [enabled, id, keys, handler, scope, description, registerShortcut]);
}
```

### B.3 Command Palette

```tsx
// packages/ui/src/components/command-palette/command-palette.tsx
'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { cn } from '../../lib/utils';

export interface CommandGroup {
  id: string;
  heading: string;
  commands: CommandItem[];
}

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string[];
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandGroup[];
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'fixed top-[20%] left-1/2 -translate-x-1/2 z-50',
        'w-full max-w-[640px]',
        'rounded-xl border border-border bg-card shadow-2xl',
        'overflow-hidden'
      )}
    >
      <Command.Input
        placeholder="Type a command or search..."
        className={cn(
          'w-full px-4 py-4 text-base',
          'bg-transparent border-b border-border',
          'outline-none placeholder:text-muted-foreground font-mono'
        )}
      />
      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-muted-foreground">
          No results found.
        </Command.Empty>
        {commands.map((group) => (
          <Command.Group
            key={group.id}
            heading={group.heading}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {group.commands.map((command) => (
              <Command.Item
                key={command.id}
                value={command.label}
                onSelect={() => { command.onSelect(); onOpenChange(false); }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
                  'aria-selected:bg-accent aria-selected:text-accent-foreground'
                )}
              >
                {command.icon && <span className="text-muted-foreground">{command.icon}</span>}
                <span className="flex-1">{command.label}</span>
                {command.shortcut && (
                  <kbd className="flex gap-1">
                    {command.shortcut.map((key, i) => (
                      <span key={i} className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-xs font-mono text-muted-foreground">
                        {formatKey(key)}
                      </span>
                    ))}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

function formatKey(key: string): string {
  const map: Record<string, string> = {
    'Meta': '\u2318', 'Control': 'Ctrl', 'Alt': '\u2325', 'Shift': '\u21e7',
    'Enter': '\u21b5', 'Escape': 'Esc', 'ArrowUp': '\u2191', 'ArrowDown': '\u2193',
  };
  return map[key] || key.toUpperCase();
}
```

### B.4 Navigable List (Vim-style)

```tsx
// packages/ui/src/components/navigable-list/navigable-list.tsx
'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { useShortcut } from '../../hooks/use-keyboard-shortcuts';

interface NavigableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  onSelect: (item: T, index: number) => void;
  onBack?: () => void;
  getItemId?: (item: T, index: number) => string;
  className?: string;
}

export function NavigableList<T>({
  items,
  renderItem,
  onSelect,
  onBack,
  getItemId = (_, i) => String(i),
  className,
}: NavigableListProps<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const itemRefs = React.useRef<Map<number, HTMLElement>>(new Map());

  React.useEffect(() => {
    itemRefs.current.get(selectedIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  // j - Move down
  useShortcut(['j'], () => setSelectedIndex(Math.min(selectedIndex + 1, items.length - 1)),
    { id: 'list-down', description: 'Move down' });

  // k - Move up
  useShortcut(['k'], () => setSelectedIndex(Math.max(selectedIndex - 1, 0)),
    { id: 'list-up', description: 'Move up' });

  // Enter - Select
  useShortcut(['Enter'], () => items[selectedIndex] && onSelect(items[selectedIndex], selectedIndex),
    { id: 'list-select', description: 'Select item' });

  // Escape - Go back
  useShortcut(['Escape'], () => onBack?.(),
    { id: 'list-back', description: 'Go back', enabled: !!onBack });

  // Arrow alternatives
  useShortcut(['ArrowDown'], () => setSelectedIndex(Math.min(selectedIndex + 1, items.length - 1)),
    { id: 'list-arrow-down', description: 'Move down' });
  useShortcut(['ArrowUp'], () => setSelectedIndex(Math.max(selectedIndex - 1, 0)),
    { id: 'list-arrow-up', description: 'Move up' });

  // gg - Go to top
  useShortcut(['g', 'g'], () => setSelectedIndex(0),
    { id: 'list-top', description: 'Go to top' });

  // G - Go to bottom
  useShortcut(['Shift', 'g'], () => setSelectedIndex(items.length - 1),
    { id: 'list-bottom', description: 'Go to bottom' });

  return (
    <div role="listbox" aria-activedescendant={`item-${selectedIndex}`} tabIndex={0} className={cn('outline-none', className)}>
      {items.map((item, index) => (
        <div
          key={getItemId(item, index)}
          id={`item-${index}`}
          ref={(el) => { if (el) itemRefs.current.set(index, el); }}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => { setSelectedIndex(index); onSelect(item, index); }}
          className={cn(
            'cursor-pointer transition-colors',
            index === selectedIndex && 'bg-accent'
          )}
        >
          {renderItem(item, index, index === selectedIndex)}
        </div>
      ))}
    </div>
  );
}
```

### B.5 Go-To Shortcuts

```typescript
// packages/ui/src/hooks/use-goto-shortcuts.ts
'use client';

import { useRouter } from 'next/navigation';
import { useShortcut } from './use-keyboard-shortcuts';

const goToRoutes = {
  'd': '/dashboard',
  'p': '/dashboard/projects',
  's': '/dashboard/scan',
  'r': '/dashboard/reports',
  'i': '/dashboard/issues',
  't': '/dashboard/settings',
};

export function useGoToShortcuts() {
  const router = useRouter();

  Object.entries(goToRoutes).forEach(([key, path]) => {
    useShortcut(['g', key], () => router.push(path), {
      id: `goto-${key}`,
      description: `Go to ${path.split('/').pop()}`,
      scope: 'global',
    });
  });
}
```

### B.6 Shortcuts Help Modal

```tsx
// packages/ui/src/components/shortcuts-help/shortcuts-help.tsx
'use client';

import * as React from 'react';
import { useKeyboardShortcuts, useShortcut } from '../../hooks/use-keyboard-shortcuts';
import { cn } from '../../lib/utils';

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { getActiveShortcuts } = useKeyboardShortcuts();
  const shortcuts = getActiveShortcuts();

  // Group by category
  const grouped = React.useMemo(() => {
    const groups: Record<string, typeof shortcuts> = { Navigation: [], Actions: [], 'List Navigation': [], Other: [] };
    shortcuts.forEach((s) => {
      if (s.keys[0] === 'g') groups['Navigation'].push(s);
      else if (['j', 'k', 'Enter', 'Escape'].some(k => s.keys.includes(k))) groups['List Navigation'].push(s);
      else if (s.keys.some(k => ['Meta', 'Control'].includes(k))) groups['Actions'].push(s);
      else groups['Other'].push(s);
    });
    return groups;
  }, [shortcuts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-auto bg-card rounded-xl border border-border shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-accent rounded-lg">X</button>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {Object.entries(grouped).map(([category, items]) => items.length > 0 && (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{s.description}</span>
                    <span className="flex gap-1">
                      {s.keys.map((k, i) => (
                        <kbd key={i} className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono">{k}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useShortcutsHelp() {
  const [open, setOpen] = React.useState(false);
  useShortcut(['?'], () => setOpen(prev => !prev), { id: 'toggle-help', description: 'Show keyboard shortcuts', scope: 'global' });
  return { open, setOpen };
}
```

### B.7 Root Provider Integration

```tsx
// apps/site/src/app/providers.tsx
'use client';

import * as React from 'react';
import { QueryProvider } from '@/lib/query/provider';
import { EventStreamProvider } from '@/lib/query/hooks/use-event-stream';
import { KeyboardProvider, useShortcut } from '@doccov/ui/keyboard';
import { CommandPalette } from '@doccov/ui/command-palette';
import { ShortcutsHelp, useShortcutsHelp } from '@doccov/ui/shortcuts-help';
import { useGoToShortcuts } from '@doccov/ui/hooks';
import { useRouter } from 'next/navigation';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <EventStreamProvider>
        <KeyboardProvider>
          <KeyboardManager>{children}</KeyboardManager>
        </KeyboardProvider>
      </EventStreamProvider>
    </QueryProvider>
  );
}

function KeyboardManager({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [cmdPaletteOpen, setCmdPaletteOpen] = React.useState(false);
  const { open: helpOpen, setOpen: setHelpOpen } = useShortcutsHelp();

  useGoToShortcuts();
  useShortcut(['Meta', 'k'], () => setCmdPaletteOpen(true), { id: 'open-palette', description: 'Open command palette', scope: 'global' });

  const commands = [
    {
      id: 'navigation',
      heading: 'Navigation',
      commands: [
        { id: 'goto-dashboard', label: 'Go to Dashboard', shortcut: ['G', 'D'], onSelect: () => router.push('/dashboard') },
        { id: 'goto-projects', label: 'Go to Projects', shortcut: ['G', 'P'], onSelect: () => router.push('/dashboard/projects') },
        { id: 'goto-scan', label: 'Go to Scan', shortcut: ['G', 'S'], onSelect: () => router.push('/dashboard/scan') },
      ],
    },
    {
      id: 'actions',
      heading: 'Actions',
      commands: [
        { id: 'new-scan', label: 'Run New Scan', shortcut: ['N'], onSelect: () => {} },
        { id: 'help', label: 'Show Shortcuts', shortcut: ['?'], onSelect: () => setHelpOpen(true) },
      ],
    },
  ];

  return (
    <>
      {children}
      <CommandPalette open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen} commands={commands} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
```

---

## Part C: Backend Infrastructure (Supabase + Trigger.dev)

### C.1 Supabase PostgreSQL Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- REPOSITORIES
-- ===========================================
CREATE TABLE repos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id BIGINT UNIQUE NOT NULL,
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(512) GENERATED ALWAYS AS (owner || '/' || name) STORED,
  default_branch VARCHAR(255) DEFAULT 'main',
  private BOOLEAN DEFAULT false,
  installation_id BIGINT,
  webhook_enabled BOOLEAN DEFAULT true,

  -- Denormalized for fast dashboard queries
  latest_scan_id UUID,
  latest_coverage_score NUMERIC(5,2),
  latest_scan_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT repos_owner_name_unique UNIQUE (owner, name)
);

CREATE INDEX idx_repos_full_name ON repos (full_name);
CREATE INDEX idx_repos_latest_coverage ON repos (latest_coverage_score DESC NULLS LAST);

-- ===========================================
-- SCANS
-- ===========================================
CREATE TYPE scan_status AS ENUM ('pending', 'running', 'complete', 'failed', 'cancelled');
CREATE TYPE scan_trigger AS ENUM ('push', 'pull_request', 'manual', 'schedule');

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  ref VARCHAR(255) NOT NULL,
  commit_sha VARCHAR(40),
  pr_number INTEGER,
  package_name VARCHAR(255),

  status scan_status DEFAULT 'pending',
  trigger scan_trigger DEFAULT 'manual',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage VARCHAR(50),

  result JSONB,
  coverage_score NUMERIC(5,2),
  export_count INTEGER,
  drift_count INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  job_id UUID
);

CREATE INDEX idx_scans_repo_id ON scans (repo_id);
CREATE INDEX idx_scans_status ON scans (status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_scans_created ON scans (created_at DESC);

-- ===========================================
-- COVERAGE HISTORY (time-series)
-- ===========================================
CREATE TABLE coverage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  ref VARCHAR(255) NOT NULL,
  commit_sha VARCHAR(40),

  coverage_score NUMERIC(5,2) NOT NULL,
  export_count INTEGER NOT NULL,
  drift_count INTEGER NOT NULL,
  coverage_delta NUMERIC(5,2),

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coverage_history_repo ON coverage_history (repo_id, recorded_at DESC);

-- ===========================================
-- DRIFT SNAPSHOTS
-- ===========================================
CREATE TABLE drift_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,

  export_name VARCHAR(255) NOT NULL,
  drift_type VARCHAR(50) NOT NULL,
  issue TEXT NOT NULL,
  suggestion TEXT,

  status VARCHAR(20) DEFAULT 'active', -- active, dismissed, snoozed
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drift_repo_active ON drift_snapshots (repo_id) WHERE status = 'active';

-- ===========================================
-- JOBS (lightweight queue)
-- ===========================================
CREATE TYPE job_status AS ENUM ('pending', 'running', 'complete', 'failed');
CREATE TYPE job_type AS ENUM ('scan', 'diff', 'report');

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type job_type NOT NULL,
  status job_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  payload JSONB NOT NULL,

  progress INTEGER DEFAULT 0,
  progress_message TEXT,
  result JSONB,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  idempotency_key VARCHAR(255) UNIQUE
);

CREATE INDEX idx_jobs_pending ON jobs (status, priority DESC, created_at) WHERE status = 'pending';

-- ===========================================
-- WEBHOOK DELIVERIES (audit log)
-- ===========================================
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  repo_id UUID REFERENCES repos(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- AUTO-UPDATE TRIGGERS
-- ===========================================
CREATE OR REPLACE FUNCTION update_repo_latest_scan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'complete' THEN
    UPDATE repos SET
      latest_scan_id = NEW.id,
      latest_coverage_score = NEW.coverage_score,
      latest_scan_at = NEW.completed_at,
      updated_at = NOW()
    WHERE id = NEW.repo_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_repo_latest_scan
  AFTER UPDATE OF status ON scans
  FOR EACH ROW WHEN (NEW.status = 'complete')
  EXECUTE FUNCTION update_repo_latest_scan();

-- Enable Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE scans;
ALTER PUBLICATION supabase_realtime ADD TABLE repos;
```

### C.2 Drizzle Schema

```typescript
// packages/api/src/db/schema.ts
import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, pgEnum, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const scanStatusEnum = pgEnum('scan_status', ['pending', 'running', 'complete', 'failed', 'cancelled']);
export const scanTriggerEnum = pgEnum('scan_trigger', ['push', 'pull_request', 'manual', 'schedule']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'complete', 'failed']);
export const jobTypeEnum = pgEnum('job_type', ['scan', 'diff', 'report']);

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').notNull().unique(),
  owner: varchar('owner', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).default('main'),
  private: boolean('private').default(false),
  installationId: integer('installation_id'),
  webhookEnabled: boolean('webhook_enabled').default(true),
  latestScanId: uuid('latest_scan_id'),
  latestCoverageScore: numeric('latest_coverage_score', { precision: 5, scale: 2 }),
  latestScanAt: timestamp('latest_scan_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  ownerNameUnique: uniqueIndex('repos_owner_name_unique').on(table.owner, table.name),
}));

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  repoId: uuid('repo_id').notNull().references(() => repos.id, { onDelete: 'cascade' }),
  ref: varchar('ref', { length: 255 }).notNull(),
  commitSha: varchar('commit_sha', { length: 40 }),
  prNumber: integer('pr_number'),
  packageName: varchar('package_name', { length: 255 }),
  status: scanStatusEnum('status').default('pending'),
  trigger: scanTriggerEnum('trigger').default('manual'),
  progress: integer('progress').default(0),
  stage: varchar('stage', { length: 50 }),
  result: jsonb('result'),
  coverageScore: numeric('coverage_score', { precision: 5, scale: 2 }),
  exportCount: integer('export_count'),
  driftCount: integer('drift_count'),
  errorMessage: varchar('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  jobId: uuid('job_id'),
}, (table) => ({
  repoIdIdx: index('idx_scans_repo_id').on(table.repoId),
  statusIdx: index('idx_scans_status').on(table.status),
}));

export const coverageHistory = pgTable('coverage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  repoId: uuid('repo_id').notNull().references(() => repos.id, { onDelete: 'cascade' }),
  scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  ref: varchar('ref', { length: 255 }).notNull(),
  commitSha: varchar('commit_sha', { length: 40 }),
  coverageScore: numeric('coverage_score', { precision: 5, scale: 2 }).notNull(),
  exportCount: integer('export_count').notNull(),
  driftCount: integer('drift_count').notNull(),
  coverageDelta: numeric('coverage_delta', { precision: 5, scale: 2 }),
  recordedAt: timestamp('recorded_at').defaultNow(),
});

export const driftSnapshots = pgTable('drift_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  repoId: uuid('repo_id').notNull().references(() => repos.id, { onDelete: 'cascade' }),
  exportName: varchar('export_name', { length: 255 }).notNull(),
  driftType: varchar('drift_type', { length: 50 }).notNull(),
  issue: varchar('issue').notNull(),
  suggestion: varchar('suggestion'),
  status: varchar('status', { length: 20 }).default('active'),
  dismissedAt: timestamp('dismissed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: jobTypeEnum('type').notNull(),
  status: jobStatusEnum('status').default('pending'),
  priority: integer('priority').default(0),
  payload: jsonb('payload').notNull(),
  progress: integer('progress').default(0),
  progressMessage: varchar('progress_message'),
  result: jsonb('result'),
  error: varchar('error'),
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: varchar('delivery_id', { length: 255 }).unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'set null' }),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').default(false),
  error: varchar('error'),
  receivedAt: timestamp('received_at').defaultNow(),
});
```

### C.3 Trigger.dev Setup

```typescript
// packages/api/src/jobs/trigger.ts
import { TriggerClient } from "@trigger.dev/sdk";

export const client = new TriggerClient({
  id: "doccov",
  apiKey: process.env.TRIGGER_DEV_API_KEY!,
  apiUrl: process.env.TRIGGER_DEV_API_URL,
});
```

### C.4 Scan Job Definition

```typescript
// packages/api/src/jobs/scan.job.ts
import { eventTrigger } from "@trigger.dev/sdk";
import { client } from "./trigger";
import { db } from "../db";
import { jobs, scans, coverageHistory, driftSnapshots, repos } from "../db/schema";
import { eq } from "drizzle-orm";

export const scanJob = client.defineJob({
  id: "scan-repo",
  name: "Scan Repository Documentation",
  version: "1.0.0",
  trigger: eventTrigger({ name: "scan.requested" }),

  run: async (payload, io) => {
    const { jobId, repoId, ref, commitSha, prNumber, trigger } = payload;

    // Update job status
    await io.runTask("update-job-started", async () => {
      await db.update(jobs).set({ status: 'running', startedAt: new Date() }).where(eq(jobs.id, jobId));
    });

    // Get repo info
    const repo = await io.runTask("get-repo", async () => {
      return db.query.repos.findFirst({ where: eq(repos.id, repoId) });
    });

    if (!repo) throw new Error(`Repo not found: ${repoId}`);

    // Create scan record
    const [scan] = await io.runTask("create-scan", async () => {
      return db.insert(scans).values({
        repoId, ref, commitSha, prNumber, trigger, status: 'running', jobId,
      }).returning();
    });

    // Send progress events
    await io.sendEvent("progress", {
      name: "scan.progress",
      payload: { scanId: scan.id, jobId, stage: "cloning", progress: 5, message: `Cloning ${repo.owner}/${repo.name}...` },
    });

    try {
      // Run scan (simplified - actual implementation uses Vercel Sandbox)
      const result = await io.runTask("run-scan", async () => {
        // ... scan logic from existing scan-stream.ts
        return { coverage: 85, exportCount: 42, driftCount: 3, drift: [], undocumented: [] };
      });

      // Save results
      await io.runTask("save-results", async () => {
        await db.update(scans).set({
          status: 'complete', result, coverageScore: String(result.coverage),
          exportCount: result.exportCount, driftCount: result.driftCount,
          completedAt: new Date(), progress: 100, stage: 'complete',
        }).where(eq(scans.id, scan.id));

        await db.insert(coverageHistory).values({
          repoId, scanId: scan.id, ref, commitSha,
          coverageScore: String(result.coverage), exportCount: result.exportCount, driftCount: result.driftCount,
        });

        await db.update(jobs).set({ status: 'complete', result, completedAt: new Date() }).where(eq(jobs.id, jobId));
      });

      // Send completion event
      await io.sendEvent("complete", {
        name: "scan.complete",
        payload: { scanId: scan.id, jobId, repoId, result },
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await db.update(scans).set({ status: 'failed', errorMessage, completedAt: new Date() }).where(eq(scans.id, scan.id));
      await db.update(jobs).set({ status: 'failed', error: errorMessage, completedAt: new Date() }).where(eq(jobs.id, jobId));

      await io.sendEvent("error", { name: "scan.error", payload: { scanId: scan.id, jobId, error: errorMessage } });
      throw error;
    }
  },
});
```

### C.5 GitHub Webhook Handler

```typescript
// packages/api/api/webhooks/github.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db';
import { jobs, webhookDeliveries, repos } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { client } from '../../src/jobs/trigger';

export const config = { runtime: 'nodejs', maxDuration: 10 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const signature = req.headers['x-hub-signature-256'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;
  const eventType = req.headers['x-github-event'] as string;
  const payload = req.body;

  // Verify signature
  if (!verifySignature(JSON.stringify(payload), signature, process.env.GITHUB_WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Log delivery
  const [delivery] = await db.insert(webhookDeliveries).values({
    deliveryId, eventType, payload,
  }).returning();

  // Find or create repo
  let repo = await db.query.repos.findFirst({ where: eq(repos.githubId, payload.repository.id) });

  if (!repo) {
    [repo] = await db.insert(repos).values({
      githubId: payload.repository.id,
      owner: payload.repository.owner.login,
      name: payload.repository.name,
      defaultBranch: payload.repository.default_branch,
      private: payload.repository.private,
      installationId: payload.installation?.id,
    }).returning();
  }

  await db.update(webhookDeliveries).set({ repoId: repo.id }).where(eq(webhookDeliveries.id, delivery.id));

  // Handle events
  let shouldScan = false;
  let scanPayload: any = null;

  if (eventType === 'push' && payload.ref === `refs/heads/${repo.defaultBranch}`) {
    shouldScan = true;
    scanPayload = { repoId: repo.id, ref: repo.defaultBranch, commitSha: payload.after, trigger: 'push' };
  } else if (eventType === 'pull_request' && ['opened', 'synchronize'].includes(payload.action)) {
    shouldScan = true;
    scanPayload = {
      repoId: repo.id, ref: payload.pull_request.head.ref, commitSha: payload.pull_request.head.sha,
      prNumber: payload.pull_request.number, trigger: 'pull_request',
    };
  }

  if (shouldScan && scanPayload) {
    const idempotencyKey = `${repo.id}:${scanPayload.commitSha}:${scanPayload.prNumber || 'push'}`;

    const [job] = await db.insert(jobs).values({
      type: 'scan', payload: scanPayload, idempotencyKey,
      priority: scanPayload.trigger === 'pull_request' ? 10 : 5,
    }).onConflictDoNothing().returning();

    if (job) {
      await db.update(webhookDeliveries).set({ processed: true }).where(eq(webhookDeliveries.id, delivery.id));
      await client.sendEvent({ name: 'scan.requested', payload: { jobId: job.id, ...scanPayload } });
    }
  }

  return res.status(200).json({ received: true, deliveryId });
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  try { return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
  catch { return false; }
}
```

### C.6 SSE Job Progress Endpoint

```typescript
// packages/api/api/jobs/[jobId]/stream.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../src/db';
import { jobs } from '../../../src/db/schema';
import { eq } from 'drizzle-orm';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const jobId = req.query.jobId as string;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // If already done, return immediately
  if (job.status === 'complete') return res.json({ type: 'complete', result: job.result });
  if (job.status === 'failed') return res.json({ type: 'error', error: job.error });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(':ok\n\n');

  let lastProgress = -1;
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const currentJob = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });

    if (!currentJob) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job disappeared' })}\n\n`);
      return res.end();
    }

    if (currentJob.progress !== lastProgress) {
      lastProgress = currentJob.progress || 0;
      res.write(`data: ${JSON.stringify({ type: 'progress', progress: currentJob.progress, stage: currentJob.progressMessage })}\n\n`);
    }

    if (currentJob.status === 'complete') {
      res.write(`data: ${JSON.stringify({ type: 'complete', result: currentJob.result })}\n\n`);
      return res.end();
    }

    if (currentJob.status === 'failed') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: currentJob.error })}\n\n`);
      return res.end();
    }

    if (attempts >= 300) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Timeout' })}\n\n`);
      return res.end();
    }

    setTimeout(poll, 1000);
  };

  req.on('close', () => res.end());
  poll();
}
```

---

## Part D: Implementation Phases

### Phase 1: Database + TanStack Query (Week 1-2)

- [ ] **D.1.1** Set up Supabase project
- [ ] **D.1.2** Run schema migrations
- [ ] **D.1.3** Create Drizzle schema and connect to API
- [ ] **D.1.4** Install TanStack Query in site app
- [ ] **D.1.5** Create QueryProvider with defaults
- [ ] **D.1.6** Implement query key factory
- [ ] **D.1.7** Create type-safe API client
- [ ] **D.1.8** Build core query hooks (useRepos, useDrift, etc.)
- [ ] **D.1.9** Implement optimistic mutations

### Phase 2: Keyboard Navigation (Week 2)

- [ ] **D.2.1** Install cmdk package
- [ ] **D.2.2** Create KeyboardProvider and useShortcut hook
- [ ] **D.2.3** Build CommandPalette component
- [ ] **D.2.4** Create NavigableList component
- [ ] **D.2.5** Implement go-to shortcuts (G+P, G+D, etc.)
- [ ] **D.2.6** Build ShortcutsHelp modal
- [ ] **D.2.7** Add focus ring styles to globals.css
- [ ] **D.2.8** Integrate providers in root layout

### Phase 3: Job Queue + Webhooks (Week 3)

- [ ] **D.3.1** Set up Trigger.dev project
- [ ] **D.3.2** Create trigger client
- [ ] **D.3.3** Implement scan job definition
- [ ] **D.3.4** Create GitHub webhook endpoint
- [ ] **D.3.5** Add webhook signature verification
- [ ] **D.3.6** Connect webhooks to job queue
- [ ] **D.3.7** Update vercel.json with webhook routes

### Phase 4: Real-Time Layer (Week 4)

- [ ] **D.4.1** Enable Supabase Realtime on tables
- [ ] **D.4.2** Create SSE job progress endpoint
- [ ] **D.4.3** Build useEventStream hook
- [ ] **D.4.4** Wire SSE events to cache invalidation
- [ ] **D.4.5** Add EventStreamProvider to root
- [ ] **D.4.6** Test end-to-end flow

### Phase 5: Polish + Migration (Week 5)

- [ ] **D.5.1** Create hybrid job store for gradual migration
- [ ] **D.5.2** Add feature flags for Postgres/Trigger.dev
- [ ] **D.5.3** Test with production data
- [ ] **D.5.4** Remove in-memory store
- [ ] **D.5.5** Add error handling and retries
- [ ] **D.5.6** Performance testing

---

## Cost Analysis

| Service | Free Tier | Growth ($35/mo) |
|---------|-----------|-----------------|
| Supabase | 500MB DB, 2GB bandwidth, 50K MAU | Pro: $25/mo |
| Trigger.dev | 10K runs/month | ~$10/mo for 10K extra |
| Vercel | 100GB bandwidth, 100hrs compute | Pro: $20/mo (separate) |

**Starting Cost**: $0/month (free tiers cover MVP)
**Growth Cost**: ~$35-55/month

---

## Files to Create

### Frontend (apps/site)
```
src/
  lib/
    query/
      provider.tsx
      keys.ts
      hooks/
        use-repos.ts
        use-drift.ts
        use-scans.ts
        use-event-stream.ts
    api/
      client.ts
  app/
    providers.tsx
```

### UI Package (packages/ui)
```
src/
  hooks/
    use-keyboard-shortcuts.ts
    use-goto-shortcuts.ts
  components/
    command-palette/
      command-palette.tsx
      index.ts
    navigable-list/
      navigable-list.tsx
      index.ts
    shortcuts-help/
      shortcuts-help.tsx
      index.ts
```

### Backend (packages/api)
```
src/
  db/
    index.ts
    schema.ts
  jobs/
    trigger.ts
    scan.job.ts
api/
  webhooks/
    github.ts
  jobs/
    [jobId]/
      stream.ts
```

---

## Related Issues

- #09 Historical Dashboard - Uses coverage_history table from this issue
- #14 Landing Page - Badge/scan endpoints use this infrastructure
- #15 SaaS Platform UI/UX - Keyboard navigation patterns defined here
