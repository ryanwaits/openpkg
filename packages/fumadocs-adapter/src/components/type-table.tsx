'use client';

import type { OpenPkg, SpecMember, SpecSignatureParameter } from '@openpkg-ts/spec';

export interface TypeTableProps {
  items: (SpecSignatureParameter | SpecMember)[];
  spec?: OpenPkg;
  showRequired?: boolean;
}

function formatSchema(schema: unknown): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object' && schema !== null) {
    const s = schema as Record<string, unknown>;
    // Handle $ref
    if (s.$ref && typeof s.$ref === 'string') {
      const refName = s.$ref.replace('#/types/', '');
      return refName;
    }
    // Handle type
    if (s.type) return String(s.type);
  }
  return 'unknown';
}

function isParameter(item: SpecSignatureParameter | SpecMember): item is SpecSignatureParameter {
  return 'required' in item;
}

export function TypeTable({ items, showRequired = true }: TypeTableProps): React.ReactNode {
  if (!items?.length) return null;

  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-fd-border">
            <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">Name</th>
            <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">Type</th>
            <th className="text-left py-2 px-3 font-medium text-fd-muted-foreground">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const name = item.name ?? `arg${index}`;
            const type = formatSchema(item.schema);
            const description = item.description ?? '';
            const required = isParameter(item) ? item.required : true;

            return (
              <tr key={name} className="border-b border-fd-border last:border-0">
                <td className="py-2 px-3 align-top">
                  <code className="text-fd-primary font-mono text-xs bg-fd-secondary px-1.5 py-0.5 rounded">
                    {name}
                  </code>
                  {showRequired && required && <span className="ml-1 text-red-500 text-xs">*</span>}
                  {showRequired && !required && (
                    <span className="ml-1 text-fd-muted-foreground text-xs">?</span>
                  )}
                </td>
                <td className="py-2 px-3 align-top">
                  <code className="font-mono text-xs text-fd-muted-foreground">{type}</code>
                </td>
                <td className="py-2 px-3 align-top text-fd-muted-foreground">{description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
