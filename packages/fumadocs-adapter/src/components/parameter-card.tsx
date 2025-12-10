'use client';

import type { OpenPkg, SpecSignatureParameter } from '@openpkg-ts/spec';

export interface ParameterCardProps {
  param: SpecSignatureParameter;
  spec?: OpenPkg;
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

export function ParameterCard({ param, spec }: ParameterCardProps): React.ReactNode {
  const type = formatSchema(param.schema);
  const isRequired = param.required !== false;

  return (
    <div className="rounded-lg border border-fd-border bg-fd-card/50 p-4">
      {/* Header row: name + badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-sm text-fd-foreground">{param.name}</span>
        {isRequired && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-fd-border bg-fd-muted text-fd-muted-foreground uppercase tracking-wide">
            Required
          </span>
        )}
      </div>

      {/* Type */}
      <div className="text-sm text-fd-muted-foreground font-mono">{type}</div>

      {/* Description */}
      {param.description && (
        <p className="text-sm text-fd-muted-foreground mt-2">{param.description}</p>
      )}
    </div>
  );
}
