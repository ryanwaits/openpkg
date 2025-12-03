'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { CodeExample } from './code-example';
import { CoverageBadge } from './coverage-badge';

export interface VariablePageProps {
  export: SpecExport;
  spec: OpenPkg;
}

function formatSchema(schema: unknown): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object' && schema !== null) {
    const s = schema as Record<string, unknown>;
    if (s.$ref && typeof s.$ref === 'string') {
      return s.$ref.replace('#/types/', '');
    }
    if (s.tsType) return String(s.tsType);
    if (s.type) return String(s.type);
  }
  return 'unknown';
}

export function VariablePage({ export: exp, spec }: VariablePageProps) {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
  const hasExamples = exp.examples && exp.examples.length > 0;

  return (
    <div className="space-y-8">
      {/* Description */}
      {exp.description && (
        <p className="text-fd-muted-foreground text-lg leading-relaxed">
          {exp.description}
        </p>
      )}

      {/* Declaration */}
      <div className="rounded-lg border border-fd-border bg-fd-muted/30 p-4 overflow-x-auto">
        <code className="font-mono text-sm text-fd-foreground whitespace-pre">
          const {exp.name}: {typeValue}
        </code>
      </div>

      {/* Two-column layout */}
      <div className={`grid gap-8 ${hasExamples ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left column: Type info */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-3">
              Type
            </h3>
            <div className="rounded-lg border border-fd-border bg-fd-card p-4">
              <code className="font-mono text-sm text-fd-primary">{typeValue}</code>
            </div>
          </div>
        </div>

        {/* Right column: Examples */}
        {hasExamples && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-3">
              {exp.name} usage
            </h3>
            <CodeExample 
              code={exp.examples![0]} 
              filename={`${exp.name.toLowerCase()}.ts`}
            />
          </div>
        )}
      </div>

      {/* Coverage */}
      {exp.docs && <CoverageBadge docs={exp.docs} />}
    </div>
  );
}
