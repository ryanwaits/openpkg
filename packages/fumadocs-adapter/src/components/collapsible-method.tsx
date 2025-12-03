'use client';

import { useState, useEffect } from 'react';
import type { SpecMember, SpecSchema } from '@openpkg-ts/spec';
import { ExpandableProperty } from './expandable-property';

export interface CollapsibleMethodProps {
  member: SpecMember;
  defaultExpanded?: boolean;
}

// Chevron icon component
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatSchema(schema: unknown): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object' && schema !== null) {
    const s = schema as Record<string, unknown>;
    if (s.$ref && typeof s.$ref === 'string') {
      return s.$ref.replace('#/types/', '');
    }
    if (s.tsType) {
      const tsType = String(s.tsType);
      if (tsType.length > 40) return tsType.slice(0, 37) + '...';
      return tsType;
    }
    if (s.type) return String(s.type);
  }
  return 'unknown';
}

function formatReturnType(returns: { schema?: SpecSchema; tsType?: string } | undefined): string {
  if (!returns) return 'void';
  if (returns.tsType) {
    const t = returns.tsType;
    if (t.length > 40) return t.slice(0, 37) + '...';
    return t;
  }
  return formatSchema(returns.schema);
}

function formatParamPreview(params: { name?: string }[] | undefined): string {
  if (!params || params.length === 0) return '';
  if (params.length === 1) return params[0].name || 'arg';
  return `${params[0].name || 'arg'}, ...`;
}

/**
 * Collapsible method section with expand/collapse behavior
 * Shows compact signature when collapsed, full details when expanded
 */
export function CollapsibleMethod({ member, defaultExpanded = false }: CollapsibleMethodProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const sig = member.signatures?.[0];
  const hasParams = sig?.parameters && sig.parameters.length > 0;
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isAsync = flags?.async;

  const returnType = formatReturnType(sig?.returns);
  const returnDescription = sig?.returns?.description;
  const paramPreview = formatParamPreview(sig?.parameters);

  // Auto-expand if URL hash matches this method
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === `#${member.name}`) {
      setExpanded(true);
    }
  }, [member.name]);

  return (
    <div
      id={member.name}
      className="scroll-mt-20 border-b border-fd-border last:border-0"
    >
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-4 px-1 text-left hover:bg-fd-muted/30 transition-colors cursor-pointer group"
      >
        {/* Chevron */}
        <span className="text-fd-muted-foreground group-hover:text-fd-foreground transition-colors">
          <ChevronIcon expanded={expanded} />
        </span>

        {/* Method signature preview */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-fd-foreground">
            {member.name}
            <span className="text-fd-muted-foreground font-normal">({paramPreview})</span>
          </span>
          <span className="text-fd-muted-foreground">→</span>
          <span className="font-mono text-sm text-fd-muted-foreground truncate">
            {returnType}
          </span>
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 shrink-0">
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
          {isAsync && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              async
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-6 pl-8 pr-4">
          {/* Description */}
          {member.description && (
            <p className="text-fd-muted-foreground mb-4 leading-relaxed">
              {member.description}
            </p>
          )}

          {/* Parameters */}
          {hasParams && (
            <div className="mb-4">
              <span className="text-xs uppercase tracking-wide text-fd-muted-foreground font-medium block mb-2">
                Parameters
              </span>
              <div className="border-l-2 border-fd-border pl-4">
                {sig.parameters!.map((param, index) => (
                  <ExpandableProperty key={param.name ?? index} param={param} />
                ))}
              </div>
            </div>
          )}

          {/* Returns */}
          {sig?.returns && returnType !== 'void' && (
            <div>
              <span className="text-xs uppercase tracking-wide text-fd-muted-foreground font-medium block mb-2">
                Returns
              </span>
              <div className="border-l-2 border-fd-border pl-4 py-2">
                <span className="font-mono text-sm text-fd-muted-foreground">
                  {sig.returns.tsType || formatSchema(sig.returns.schema)}
                </span>
                {returnDescription && (
                  <p className="text-sm text-fd-muted-foreground mt-1 leading-relaxed">
                    {returnDescription}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
