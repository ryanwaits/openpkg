'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import type { ReactNode } from 'react';
import { ExportCard } from './ExportCard';

export interface ExportIndexPageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Base href for links (e.g., '/docs/api') */
  baseHref: string;
  /** Optional intro description */
  description?: string;
  /** Custom className */
  className?: string;
}

type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable';

interface CategoryGroup {
  kind: ExportKind;
  label: string;
  exports: SpecExport[];
}

const KIND_ORDER: ExportKind[] = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
const KIND_LABELS: Record<ExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
};

function groupByKind(exports: SpecExport[]): CategoryGroup[] {
  const groups: Map<ExportKind, SpecExport[]> = new Map();

  for (const exp of exports) {
    const kind = (exp.kind as ExportKind) || 'variable';
    const normalizedKind = KIND_ORDER.includes(kind) ? kind : 'variable';
    const list = groups.get(normalizedKind) || [];
    list.push(exp);
    groups.set(normalizedKind, list);
  }

  return KIND_ORDER
    .filter((kind) => groups.has(kind))
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      exports: groups.get(kind)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Index page showing all exports in a grid, grouped by category.
 * AI SDK-style clean layout with responsive 2-column grid.
 */
export function ExportIndexPage({
  spec,
  baseHref,
  description,
  className,
}: ExportIndexPageProps): ReactNode {
  const groups = groupByKind(spec.exports);

  return (
    <div className={cn('space-y-10 not-prose', className)}>
      {/* Package header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {spec.name || 'API Reference'}
        </h1>
        {(description || spec.description) && (
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
            {description || spec.description}
          </p>
        )}
      </div>

      {/* Category groups */}
      {groups.map((group) => (
        <section key={group.kind}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.exports.map((exp) => (
              <ExportCard
                key={exp.id}
                name={exp.name}
                description={exp.description}
                href={`${baseHref}/${exp.id}`}
                kind={exp.kind as ExportKind}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">No exports found in this package.</p>
        </div>
      )}
    </div>
  );
}
