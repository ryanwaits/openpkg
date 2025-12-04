'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { CodeExample } from './code-example';
import { CoverageBadge } from './coverage-badge';
import { ParameterCard } from './parameter-card';

export interface FunctionPageProps {
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

export function FunctionPage({ export: exp, spec }: FunctionPageProps) {
  const sig = exp.signatures?.[0];
  const hasExamples = exp.examples && exp.examples.length > 0;
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  return (
    <div className="space-y-6 not-prose">
      {/* Description */}
      {exp.description && (
        <p className="text-fd-muted-foreground leading-relaxed">{exp.description}</p>
      )}

      {/* Returns */}
      {sig?.returns && (
        <p className="text-fd-muted-foreground text-sm">
          <span className="font-medium text-fd-foreground">Returns:</span>{' '}
          {sig.returns.description || `A ${sig.returns.tsType ?? formatSchema(sig.returns.schema)}`}
        </p>
      )}

      {/* Two-column layout - using inline styles to override prose */}
      <div
        className="not-prose"
        style={{
          display: hasExamples ? 'grid' : 'block',
          gridTemplateColumns: hasExamples ? 'repeat(2, minmax(0, 1fr))' : undefined,
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        {/* Left column: Parameters */}
        <div className="space-y-6">
          {hasParams && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
                Parameters
              </h3>
              <div className="space-y-3">
                {sig.parameters!.map((param, index) => (
                  <ParameterCard key={param.name ?? index} param={param} spec={spec} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Examples */}
        {hasExamples && (
          <div style={{ position: 'sticky', top: '5rem' }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
              Example
            </h3>
            <CodeExample
              code={exp.examples![0]}
              filename={`${exp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts`}
            />
          </div>
        )}
      </div>

      {/* Coverage */}
      {exp.docs && <CoverageBadge docs={exp.docs} />}
    </div>
  );
}
