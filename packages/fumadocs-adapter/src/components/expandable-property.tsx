'use client';

import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { useState } from 'react';

export interface ExpandablePropertyProps {
  param: SpecSignatureParameter;
  depth?: number;
}

export interface NestedPropertyProps {
  name: string;
  schema: SpecSchema;
  required?: boolean;
  depth?: number;
}

// Chevron icon component
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatType(schema: SpecSchema): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object' && schema !== null) {
    const s = schema as Record<string, unknown>;

    // Use tsType if available (most readable)
    if (s.tsType && typeof s.tsType === 'string') {
      const tsType = s.tsType as string;
      if (tsType.length > 80) {
        return `${tsType.slice(0, 77)}...`;
      }
      return tsType;
    }

    // Handle refs
    if (s.$ref && typeof s.$ref === 'string') {
      return (s.$ref as string).replace('#/types/', '');
    }

    // Handle enums
    if (s.enum && Array.isArray(s.enum)) {
      const enumVals = (s.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
      if (enumVals.length > 50) return `${enumVals.slice(0, 47)}...`;
      return enumVals;
    }

    // Handle anyOf/oneOf
    if (s.anyOf && Array.isArray(s.anyOf)) {
      return (s.anyOf as SpecSchema[]).map(formatType).join(' | ');
    }
    if (s.oneOf && Array.isArray(s.oneOf)) {
      return (s.oneOf as SpecSchema[]).map(formatType).join(' | ');
    }

    // Handle arrays
    if (s.type === 'array' && s.items) {
      return `${formatType(s.items as SpecSchema)}[]`;
    }

    // Handle basic types
    if (s.type) return String(s.type);
  }
  return 'unknown';
}

function getNestedProperties(schema: SpecSchema): Record<string, SpecSchema> | null {
  if (!schema || typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    return s.properties as Record<string, SpecSchema>;
  }
  return null;
}

function getRequiredFields(schema: SpecSchema): string[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.required)) {
    return s.required as string[];
  }
  return [];
}

function countProperties(schema: SpecSchema): number {
  const props = getNestedProperties(schema);
  return props ? Object.keys(props).length : 0;
}

/**
 * Nested property row with expandable nested objects
 */
export function NestedProperty({ name, schema, required = false, depth = 0 }: NestedPropertyProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatType(schema);
  const nestedProps = getNestedProperties(schema);
  const nestedCount = countProperties(schema);
  const hasNested = nestedCount > 0;

  // Get description from schema
  const schemaObj = schema as Record<string, unknown> | null;
  const description = schemaObj?.description as string | undefined;

  return (
    <div className="flex flex-col border-b border-fd-border last:border-0">
      {/* Property row */}
      <div className="flex flex-row items-start gap-2 py-2.5 px-3">
        {/* Name and type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-fd-foreground">
              {name}
              {!required && '?'}:
            </span>
            <span className="font-mono text-sm text-fd-muted-foreground">
              {hasNested ? 'object' : type}
            </span>
          </div>
          {description && (
            <p className="text-sm text-fd-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Expand badge for nested objects */}
        {hasNested && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md
                       bg-fd-muted text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground
                       transition-colors cursor-pointer shrink-0"
          >
            <ChevronIcon expanded={expanded} />
            <span>{nestedCount} properties</span>
          </button>
        )}
      </div>

      {/* Expanded nested properties */}
      {hasNested && expanded && nestedProps && (
        <div className="mx-3 mb-3 rounded-lg border border-fd-border bg-fd-card/50 overflow-hidden">
          {Object.entries(nestedProps).map(([propName, propSchema]) => (
            <NestedProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={getRequiredFields(schema).includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Top-level expandable property for method parameters
 * Entry point for rendering a parameter with progressive disclosure
 */
export function ExpandableProperty({ param, depth = 0 }: ExpandablePropertyProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatType(param.schema);
  const isOptional = param.required === false;
  const nestedProps = getNestedProperties(param.schema);
  const nestedCount = countProperties(param.schema);
  const hasNested = nestedCount > 0;

  return (
    <div className="flex flex-col border-b border-fd-border last:border-0">
      {/* Parameter row */}
      <div className="flex flex-row items-start gap-2 py-3">
        {/* Name and type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-fd-foreground">
              {param.name}
              {isOptional && '?'}:
            </span>
            <span className="font-mono text-sm text-fd-muted-foreground">
              {hasNested ? 'object' : type}
            </span>
          </div>
          {param.description && (
            <p className="text-sm text-fd-muted-foreground mt-1 leading-relaxed">
              {param.description}
            </p>
          )}
        </div>

        {/* Expand badge for nested objects */}
        {hasNested && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md
                       bg-fd-muted text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground
                       transition-colors cursor-pointer shrink-0"
          >
            <ChevronIcon expanded={expanded} />
            <span>{nestedCount} properties</span>
          </button>
        )}
      </div>

      {/* Expanded nested properties */}
      {hasNested && expanded && nestedProps && (
        <div className="ml-4 mb-3 rounded-lg border border-fd-border bg-fd-card/50 overflow-hidden">
          {Object.entries(nestedProps).map(([propName, propSchema]) => (
            <NestedProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={getRequiredFields(param.schema).includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
