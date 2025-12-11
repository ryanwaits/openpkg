'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { CoverageBadge } from './coverage-badge';
import { ExamplesSection } from './examples';
import { Signature } from './signature';

export interface EnumPageProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function EnumPage({ export: exp, spec: _spec }: EnumPageProps): React.ReactNode {
  const members = exp.members ?? [];

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

      {/* Enum Members */}
      {members.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Members</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-fd-border">
                  <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">
                    Value
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => {
                  // For enum members, the value might be in schema or flags
                  const value =
                    member.schema !== undefined
                      ? typeof member.schema === 'object' && member.schema !== null
                        ? ((member.schema as Record<string, unknown>).const ??
                          (member.schema as Record<string, unknown>).default ??
                          '-')
                        : member.schema
                      : '-';

                  return (
                    <tr
                      key={member.name ?? index}
                      className="border-b border-fd-border last:border-0"
                    >
                      <td className="py-2 px-3 align-top">
                        <code className="text-fd-primary font-mono text-xs bg-fd-secondary px-1.5 py-0.5 rounded">
                          {member.name}
                        </code>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <code className="font-mono text-xs text-fd-muted-foreground">
                          {String(value)}
                        </code>
                      </td>
                      <td className="py-2 px-3 align-top text-fd-muted-foreground">
                        {member.description ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
