'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { buildSignatureString, formatSchema } from '../../core/query';

export interface InterfacePageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

/**
 * Styled interface/type page component with Tailwind.
 */
export function InterfacePage({
  export: exp,
  spec,
  renderExample,
}: InterfacePageProps): React.ReactNode {
  const properties = exp.members?.filter(
    (m) => m.kind === 'property' || m.kind === 'field' || !m.kind,
  );
  const methods = exp.members?.filter((m) => m.kind === 'method' || m.kind === 'function');
  const hasExamples = exp.examples && exp.examples.length > 0;

  const signature = buildSignatureString(exp);

  return (
    <div className="space-y-6">
      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground text-base leading-relaxed">{exp.description}</p>
      )}

      {/* Declaration */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Declaration</h2>
        <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
          <code className="font-mono text-sm text-foreground">{signature}</code>
        </div>
        {exp.deprecated && (
          <div className="mt-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Deprecated:</strong> This export is deprecated.
          </div>
        )}
      </section>

      {/* Extends */}
      {exp.extends && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Extends</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <code className="font-mono text-sm text-primary">{exp.extends}</code>
          </div>
        </section>
      )}

      {/* Properties */}
      {properties && properties.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Properties</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {properties.map((prop, index) => (
                  <tr key={prop.name ?? index} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 align-top">
                      <code className="text-primary font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                        {prop.name}
                      </code>
                    </td>
                    <td className="py-2 px-3 align-top">
                      <code className="font-mono text-xs text-muted-foreground">
                        {formatSchema(prop.schema)}
                      </code>
                    </td>
                    <td className="py-2 px-3 align-top text-muted-foreground">
                      {prop.description ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              const returnType = formatSchema(sig?.returns?.schema);

              return (
                <div key={method.name ?? index} className="rounded-lg border border-border p-4">
                  <code className="font-mono text-sm text-primary">
                    {method.name}(
                    {params
                      .map((p) => {
                        const optional = p.required === false ? '?' : '';
                        const type = formatSchema(p.schema);
                        return `${p.name}${optional}: ${type}`;
                      })
                      .join(', ')}
                    ): {returnType}
                  </code>
                  {method.description && (
                    <p className="text-sm text-muted-foreground mt-2">{method.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Examples */}
      {hasExamples && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Examples</h2>
          {exp.examples!.map((example, index) => {
            const code = typeof example === 'string' ? example : example.code;
            const title = typeof example === 'string' ? undefined : example.title;
            return (
              <div key={index} className="mb-4">
                {title && <h3 className="text-sm font-medium mb-2">{title}</h3>}
                {renderExample ? (
                  renderExample(code, `${exp.name.toLowerCase()}-${index}.ts`)
                ) : (
                  <pre className="rounded-lg border border-border bg-secondary p-4 overflow-x-auto">
                    <code className="font-mono text-sm text-foreground">{code}</code>
                  </pre>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
