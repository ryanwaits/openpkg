'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { formatSchema } from '../../core/query';
import { ExpandableProperty } from '../headless/ExpandableProperty';

export interface FunctionPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

/**
 * Styled function page component with Tailwind.
 */
export function FunctionPage({
  export: exp,
  spec,
  renderExample,
}: FunctionPageProps): React.ReactNode {
  const sig = exp.signatures?.[0];
  const hasExamples = exp.examples && exp.examples.length > 0;
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  const exampleCode = hasExamples
    ? typeof exp.examples![0] === 'string'
      ? exp.examples![0]
      : exp.examples![0].code
    : '';

  return (
    <div className="space-y-6 not-prose">
      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground leading-relaxed">{exp.description}</p>
      )}

      {/* Returns */}
      {sig?.returns && (
        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">Returns:</span>{' '}
          {sig.returns.description || `A ${formatSchema(sig.returns.schema)}`}
        </p>
      )}

      {/* Two-column layout */}
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
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Parameters
              </h3>
              <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
                {sig.parameters!.map((param, index) => (
                  <div
                    key={param.name ?? index}
                    className="border-b border-border last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-mono text-sm text-foreground">{param.name}</span>
                      {param.required !== false && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {formatSchema(param.schema)}
                    </div>
                    {param.description && (
                      <p className="text-sm text-muted-foreground mt-2">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Examples */}
        {hasExamples && (
          <div style={{ position: 'sticky', top: '5rem' }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Example
            </h3>
            {renderExample ? (
              renderExample(exampleCode, `${exp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts`)
            ) : (
              <pre className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
                <code className="font-mono text-sm text-foreground">{exampleCode}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
