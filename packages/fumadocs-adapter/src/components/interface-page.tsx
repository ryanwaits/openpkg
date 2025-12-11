'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { CoverageBadge } from './coverage-badge';
import { ExamplesSection } from './examples';
import { Signature } from './signature';
import { TypeTable } from './type-table';

export interface InterfacePageProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function InterfacePage({ export: exp, spec }: InterfacePageProps): React.ReactNode {
  // For interfaces/types, members are the properties
  const properties = exp.members?.filter(
    (m) => m.kind === 'property' || m.kind === 'field' || !m.kind,
  );
  const methods = exp.members?.filter((m) => m.kind === 'method' || m.kind === 'function');

  return (
    <div className="space-y-6">
      {/* Description */}
      {exp.description && (
        <p className="text-fd-muted-foreground text-base leading-relaxed">{exp.description}</p>
      )}

      {/* Signature */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Declaration</h2>
        <Signature export={exp} />
      </section>

      {/* Extends */}
      {exp.extends && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Extends</h2>
          <div className="rounded-lg border border-fd-border bg-fd-card p-4">
            <code className="font-mono text-sm text-fd-primary">{exp.extends}</code>
          </div>
        </section>
      )}

      {/* Properties */}
      {properties && properties.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Properties</h2>
          <TypeTable items={properties} spec={spec} showRequired={true} />
        </section>
      )}

      {/* Methods */}
      {methods && methods.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Methods</h2>
          <div className="space-y-4">
            {methods.map((method, index) => {
              const sig = method.signatures?.[0];
              const params = sig?.parameters ?? [];
              const returnType = sig?.returns?.tsType ?? 'void';

              return (
                <div key={method.name ?? index} className="rounded-lg border border-fd-border p-4">
                  <code className="font-mono text-sm text-fd-primary">
                    {method.name}(
                    {params
                      .map((p) => {
                        const optional = p.required === false ? '?' : '';
                        const type =
                          typeof p.schema === 'string'
                            ? p.schema
                            : ((p.schema as Record<string, unknown>)?.tsType ?? 'unknown');
                        return `${p.name}${optional}: ${type}`;
                      })
                      .join(', ')}
                    ): {returnType}
                  </code>
                  {method.description && (
                    <p className="text-sm text-fd-muted-foreground mt-2">{method.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Examples */}
      {exp.examples && exp.examples.length > 0 && <ExamplesSection examples={exp.examples} />}

      {/* Coverage */}
      {exp.docs && <CoverageBadge docs={exp.docs} />}
    </div>
  );
}
