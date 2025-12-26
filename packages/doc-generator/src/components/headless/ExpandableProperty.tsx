'use client';

import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { useState } from 'react';
import { formatSchema } from '../../core/query';

export interface ExpandablePropertyProps {
  /** Parameter to display */
  param: SpecSignatureParameter;
  /** Nesting depth */
  depth?: number;
  /** Custom className */
  className?: string;
}

export interface NestedPropertyProps {
  /** Property name */
  name: string;
  /** Property schema */
  schema: SpecSchema;
  /** Is required */
  required?: boolean;
  /** Nesting depth */
  depth?: number;
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
 * Nested property display.
 */
export function NestedProperty({
  name,
  schema,
  required = false,
  depth = 0,
}: NestedPropertyProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatSchema(schema);
  const nestedProps = getNestedProperties(schema);
  const nestedCount = countProperties(schema);
  const hasNested = nestedCount > 0;

  const schemaObj = schema as Record<string, unknown> | null;
  const description = schemaObj?.description as string | undefined;

  return (
    <div data-property={name} data-depth={depth}>
      <div data-row>
        <span data-name>
          {name}
          {!required && '?'}:
        </span>
        <span data-type>{hasNested ? 'object' : type}</span>
        {description && <span data-description>{description}</span>}

        {hasNested && (
          <button type="button" onClick={() => setExpanded(!expanded)} data-expand>
            {nestedCount} properties
          </button>
        )}
      </div>

      {hasNested && expanded && nestedProps && (
        <div data-nested>
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
 * Headless expandable property for parameters with nested objects.
 *
 * @example
 * ```tsx
 * <ExpandableProperty param={param} />
 * ```
 */
export function ExpandableProperty({
  param,
  depth = 0,
  className,
}: ExpandablePropertyProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatSchema(param.schema);
  const isOptional = param.required === false;
  const nestedProps = getNestedProperties(param.schema);
  const nestedCount = countProperties(param.schema);
  const hasNested = nestedCount > 0;

  return (
    <div className={className} data-param={param.name} data-depth={depth}>
      <div data-row>
        <span data-name>
          {param.name}
          {isOptional && '?'}:
        </span>
        <span data-type>{hasNested ? 'object' : type}</span>
        {param.description && <span data-description>{param.description}</span>}

        {hasNested && (
          <button type="button" onClick={() => setExpanded(!expanded)} data-expand>
            {nestedCount} properties
          </button>
        )}
      </div>

      {hasNested && expanded && nestedProps && (
        <div data-nested>
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
