'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import { formatSchema } from '../../core/query';
import { CollapsibleMethod } from '../headless/CollapsibleMethod';
import { ExpandableProperty } from '../headless/ExpandableProperty';

export interface ClassPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

function PropertyItem({ member }: { member: SpecMember }) {
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isReadonly = flags?.readonly;
  const type = formatSchema(member.schema);

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-foreground">{member.name}:</span>
        <span className="text-muted-foreground font-mono text-sm">{type}</span>
        {visibility !== 'public' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {visibility}
          </span>
        )}
        {isStatic && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
            static
          </span>
        )}
        {isReadonly && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
            readonly
          </span>
        )}
      </div>
      {member.description && (
        <p className="text-sm text-muted-foreground mt-1">{member.description}</p>
      )}
    </div>
  );
}

/**
 * Styled class page component with Tailwind.
 */
export function ClassPage({ export: exp, spec, renderExample }: ClassPageProps): React.ReactNode {
  const hasExamples = exp.examples && exp.examples.length > 0;

  const constructors = exp.members?.filter((m) => m.kind === 'constructor') ?? [];
  const properties = exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field') ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method') ?? [];

  const constructorSig = constructors[0]?.signatures?.[0];
  const constructorParams = constructorSig?.parameters ?? [];

  const exampleCode = hasExamples
    ? typeof exp.examples![0] === 'string'
      ? exp.examples![0]
      : exp.examples![0].code
    : '';

  return (
    <div className="space-y-8">
      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground text-lg leading-relaxed">{exp.description}</p>
      )}

      {/* Declaration */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
        <code className="font-mono text-sm text-foreground whitespace-pre">
          class {exp.name}
          {exp.extends ? ` extends ${exp.extends}` : ''}
          {exp.implements?.length ? ` implements ${exp.implements.join(', ')}` : ''}
        </code>
      </div>

      {/* Two-column layout */}
      <div className={`grid gap-8 ${hasExamples ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left column */}
        <div className="space-y-8">
          {/* Constructor */}
          {constructorParams.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Constructor
              </h3>
              <div className="ml-2 border-l-2 border-border pl-4">
                {constructorParams.map((param, index) => (
                  <ExpandableProperty key={param.name ?? index} param={param} />
                ))}
              </div>
            </section>
          )}

          {/* Methods */}
          {methods.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Methods
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                {methods.map((member, index) => (
                  <CollapsibleMethod
                    key={member.name ?? index}
                    member={member}
                    defaultExpanded={index === 0}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Properties */}
          {properties.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Properties
              </h3>
              <div className="rounded-lg border border-border bg-card px-4">
                {properties.map((member, index) => (
                  <PropertyItem key={member.name ?? index} member={member} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: Examples */}
        {hasExamples && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Example
            </h3>
            {renderExample ? (
              renderExample(exampleCode, `${exp.name.toLowerCase()}.ts`)
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
