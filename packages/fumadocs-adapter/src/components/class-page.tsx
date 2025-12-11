'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import { CodeExample } from './code-example';
import { CollapsibleMethod } from './collapsible-method';
import { CoverageBadge } from './coverage-badge';
import { ExpandableProperty } from './expandable-property';

export interface ClassPageProps {
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

/**
 * Compact property display for class properties (not method params)
 */
function PropertyItem({ member }: { member: SpecMember }) {
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isReadonly = flags?.readonly;
  const type = formatSchema(member.schema);

  return (
    <div className="py-3 border-b border-fd-border last:border-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-fd-foreground">{member.name}:</span>
        <span className="text-fd-muted-foreground font-mono text-sm">{type}</span>
        {visibility !== 'public' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-fd-muted text-fd-muted-foreground">
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
        <p className="text-sm text-fd-muted-foreground mt-1">{member.description}</p>
      )}
    </div>
  );
}

export function ClassPage({ export: exp, spec: _spec }: ClassPageProps): React.ReactNode {
  const hasExamples = exp.examples && exp.examples.length > 0;

  // Group members
  const constructors = exp.members?.filter((m) => m.kind === 'constructor') ?? [];
  const properties = exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field') ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method') ?? [];

  // Get constructor parameters
  const constructorSig = constructors[0]?.signatures?.[0];
  const constructorParams = constructorSig?.parameters ?? [];

  return (
    <div className="space-y-8">
      {/* Description */}
      {exp.description && (
        <p className="text-fd-muted-foreground text-lg leading-relaxed">{exp.description}</p>
      )}

      {/* Declaration */}
      <div className="rounded-lg border border-fd-border bg-fd-muted/30 p-4 overflow-x-auto">
        <code className="font-mono text-sm text-fd-foreground whitespace-pre">
          class {exp.name}
          {exp.extends ? ` extends ${exp.extends}` : ''}
          {exp.implements?.length ? ` implements ${exp.implements.join(', ')}` : ''}
        </code>
      </div>

      {/* Two-column layout for content + example */}
      <div className={`grid gap-8 ${hasExamples ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left column: Constructor, Methods, Properties */}
        <div className="space-y-8">
          {/* Constructor */}
          {constructorParams.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
                Constructor
              </h3>
              <div className="ml-2 border-l-2 border-fd-border pl-4">
                {constructorParams.map((param, index) => (
                  <ExpandableProperty key={param.name ?? index} param={param} />
                ))}
              </div>
            </section>
          )}

          {/* Methods - collapsible sections */}
          {methods.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
                Methods
              </h3>
              <div className="rounded-lg border border-fd-border overflow-hidden">
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

          {/* Properties - compact list */}
          {properties.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
                Properties
              </h3>
              <div className="rounded-lg border border-fd-border bg-fd-card px-4">
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground mb-4">
              Example
            </h3>
            <CodeExample code={exp.examples![0]} filename={`${exp.name.toLowerCase()}.ts`} />
          </div>
        )}
      </div>

      {/* Coverage */}
      {exp.docs && <CoverageBadge docs={exp.docs} />}
    </div>
  );
}
