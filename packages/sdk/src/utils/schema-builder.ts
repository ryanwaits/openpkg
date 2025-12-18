/**
 * Schema building utilities.
 * Builds JSON Schema from TypeScript type nodes and provides schema utilities.
 */
import type * as TS from 'typescript';
import { ts } from '../ts-module';
import type { ParsedJSDoc } from './tsdoc-utils';
import { isBuiltInType } from './type-utils';

/**
 * Built-in type schemas
 */
export const BUILTIN_TYPE_SCHEMAS: Record<string, Record<string, unknown>> = {
  Date: { type: 'string', format: 'date-time' },
  RegExp: { type: 'object', description: 'RegExp' },
  Error: { type: 'object' },
  Promise: { type: 'object' },
  Map: { type: 'object' },
  Set: { type: 'object' },
  WeakMap: { type: 'object' },
  WeakSet: { type: 'object' },
  Function: { type: 'object' },
  ArrayBuffer: { type: 'string', format: 'binary' },
  ArrayBufferLike: { type: 'string', format: 'binary' },
  DataView: { type: 'string', format: 'binary' },
  Uint8Array: { type: 'string', format: 'byte' },
  Uint16Array: { type: 'string', format: 'byte' },
  Uint32Array: { type: 'string', format: 'byte' },
  Int8Array: { type: 'string', format: 'byte' },
  Int16Array: { type: 'string', format: 'byte' },
  Int32Array: { type: 'string', format: 'byte' },
  Float32Array: { type: 'string', format: 'byte' },
  Float64Array: { type: 'string', format: 'byte' },
  BigInt64Array: { type: 'string', format: 'byte' },
  BigUint64Array: { type: 'string', format: 'byte' },
};

export function isObjectLiteralType(type: TS.Type): type is TS.ObjectType {
  if (!(type.getFlags() & ts.TypeFlags.Object)) {
    return false;
  }
  const objectFlags = (type as ts.ObjectType).objectFlags;
  return (objectFlags & ts.ObjectFlags.ObjectLiteral) !== 0;
}

export function isPureRefSchema(value: Record<string, unknown>): value is { $ref: string } {
  return Object.keys(value).length === 1 && '$ref' in value;
}

export function withDescription(
  schema: Record<string, unknown>,
  description: string,
): Record<string, unknown> {
  if (isPureRefSchema(schema)) {
    return {
      allOf: [schema],
      description,
    };
  }

  return {
    ...schema,
    description,
  };
}

export interface StructuredProperty {
  name: string;
  type: string | Record<string, unknown>;
  description?: string;
  optional?: boolean;
}

/**
 * Convert array of properties to OpenAPI-style object schema
 */
export function propertiesToSchema(
  properties: StructuredProperty[],
  description?: string,
): Record<string, unknown> {
  const schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  } = {
    type: 'object',
    properties: {},
  };

  const required: string[] = [];

  for (const prop of properties) {
    const propType = prop.type;
    // Convert the type to proper schema format
    let propSchema: Record<string, unknown>;

    if (typeof propType === 'string') {
      // Handle primitive types
      if (['string', 'number', 'boolean', 'bigint', 'null'].includes(propType)) {
        propSchema = { type: propType === 'bigint' ? 'string' : propType };
      } else {
        // Complex type string
        propSchema = { type: propType };
      }
    } else if (propType && typeof propType === 'object') {
      // Already a proper schema object ($ref, anyOf, etc.)
      propSchema = propType;
    } else {
      propSchema = { type: 'any' };
    }

    if (prop.description && typeof propSchema === 'object') {
      propSchema = withDescription(propSchema, prop.description);
    }

    schema.properties[prop.name] = propSchema;

    if (!prop.optional) {
      required.push(prop.name);
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }

  if (description) {
    return withDescription(schema, description);
  }

  return schema;
}

/**
 * Format type reference - forward declaration to avoid circular dependency.
 */
export type FormatTypeReferenceFn = (
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
) => string | Record<string, unknown>;

let _formatTypeReference: FormatTypeReferenceFn | null = null;

export function setSchemaBuilderFormatTypeReference(fn: FormatTypeReferenceFn): void {
  _formatTypeReference = fn;
}

export function buildSchemaFromTypeNode(
  node: TS.TypeNode,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string> | undefined,
  functionDoc: ParsedJSDoc | null,
  parentParamName: string,
): Record<string, unknown> {
  if (ts.isParenthesizedTypeNode(node)) {
    return buildSchemaFromTypeNode(
      node.type,
      typeChecker,
      typeRefs,
      referencedTypes,
      functionDoc ?? null,
      parentParamName,
    );
  }

  if (ts.isIntersectionTypeNode(node)) {
    const schemas = node.types.map((type) =>
      buildSchemaFromTypeNode(
        type,
        typeChecker,
        typeRefs,
        referencedTypes,
        functionDoc,
        parentParamName,
      ),
    );
    return { allOf: schemas };
  }

  if (ts.isUnionTypeNode(node)) {
    const schemas = node.types.map((type) =>
      buildSchemaFromTypeNode(
        type,
        typeChecker,
        typeRefs,
        referencedTypes,
        functionDoc,
        parentParamName,
      ),
    );
    return { anyOf: schemas };
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      type: 'array',
      items: buildSchemaFromTypeNode(
        node.elementType,
        typeChecker,
        typeRefs,
        referencedTypes,
        functionDoc,
        parentParamName,
      ),
    };
  }

  if (ts.isTypeLiteralNode(node)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !member.name) {
        continue;
      }

      const propName = member.name.getText();
      let schema: Record<string, unknown> | string = 'any';

      if (member.type) {
        const memberType = typeChecker.getTypeFromTypeNode(member.type);
        const formatted = _formatTypeReference
          ? _formatTypeReference(memberType, typeChecker, typeRefs, referencedTypes)
          : { type: 'any' };

        if (typeof formatted === 'string') {
          if (formatted === 'any') {
            schema = buildSchemaFromTypeNode(
              member.type,
              typeChecker,
              typeRefs,
              referencedTypes,
              functionDoc,
              parentParamName,
            );
          } else {
            schema = { type: formatted };
          }
        } else {
          schema = formatted;
        }
      } else {
        schema = { type: 'any' };
      }

      const description = getDocDescriptionForProperty(functionDoc, parentParamName, propName);
      if (typeof schema === 'object' && description) {
        schema = withDescription(schema as Record<string, unknown>, description);
      }

      properties[propName] = schema;

      if (!member.questionToken) {
        required.push(propName);
      }
    }

    const schema: Record<string, unknown> = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    return schema;
  }

  if (ts.isTypeReferenceNode(node)) {
    const typeName = node.typeName.getText();
    if (typeName === 'Array') {
      return { type: 'array' };
    }

    const builtInSchema = BUILTIN_TYPE_SCHEMAS[typeName];
    if (builtInSchema) {
      return { ...builtInSchema };
    }

    if (isBuiltInType(typeName)) {
      return { type: 'object' };
    }

    if (!typeRefs.has(typeName)) {
      typeRefs.set(typeName, typeName);
    }
    referencedTypes?.add(typeName);
    return { $ref: `#/types/${typeName}` };
  }

  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) {
      return { enum: [node.literal.text] };
    }
    if (ts.isNumericLiteral(node.literal)) {
      return { enum: [Number(node.literal.text)] };
    }
  }

  if (ts.isIntersectionTypeNode(node)) {
    const schemas = node.types.map((typeNode) =>
      buildSchemaFromTypeNode(
        typeNode,
        typeChecker,
        typeRefs,
        referencedTypes,
        functionDoc,
        parentParamName,
      ),
    );

    if (schemas.some((schema) => '$ref' in schema && Object.keys(schema).length === 1)) {
      const refs = schemas.filter((schema) => '$ref' in schema && Object.keys(schema).length === 1);
      const nonRefs = schemas.filter(
        (schema) => !('$ref' in schema && Object.keys(schema).length === 1),
      );

      if (refs.length === schemas.length) {
        return refs[0];
      }

      if (nonRefs.length > 0) {
        const merged: Record<string, unknown> = {};
        for (const obj of nonRefs as Array<Record<string, unknown>>) {
          for (const [k, v] of Object.entries(obj)) {
            merged[k] = v;
          }
        }
        return merged;
      }
    }

    return {
      allOf: schemas,
    };
  }

  // Fallback: return textual representation
  return { type: node.getText() };
}

export function getDocDescriptionForProperty(
  functionDoc: ParsedJSDoc | null,
  parentParamName: string,
  propName: string,
  inferredAlias?: string,
): string | undefined {
  if (!functionDoc) {
    return undefined;
  }

  // Try multiple matching strategies for destructured param TSDoc
  const match = functionDoc.params.find(
    (p) =>
      // Exact match with original param name
      p.name === `${parentParamName}.${propName}` ||
      // Match with inferred alias (e.g., opts.name when @param opts.name)
      (inferredAlias && p.name === `${inferredAlias}.${propName}`) ||
      // Fallback: any param ending with .propName (for __0 cases)
      (parentParamName.match(/^__\d+$/) && p.name.endsWith(`.${propName}`)),
  );
  return match?.description;
}

/**
 * Find a discriminator property in a union of object types (tagged union pattern).
 * A valid discriminator has a unique literal value in each union member.
 */
export function findDiscriminatorProperty(
  unionTypes: TS.Type[],
  typeChecker: TS.TypeChecker,
): string | undefined {
  // All members must be object types with properties
  const memberProps: Map<string, string | number>[] = [];

  for (const t of unionTypes) {
    // Skip null/undefined in unions
    if (t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
      continue;
    }

    const props = t.getProperties();
    if (!props || props.length === 0) {
      return undefined; // Not an object type
    }

    const propValues = new Map<string, string | number>();
    for (const prop of props) {
      // Get declaration safely
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!declaration) {
        continue; // Skip properties without declarations
      }

      try {
        const propType = typeChecker.getTypeOfSymbolAtLocation(prop, declaration);

        // Check if it's a literal type
        if (propType.isStringLiteral()) {
          propValues.set(prop.getName(), propType.value);
        } else if (propType.isNumberLiteral()) {
          propValues.set(prop.getName(), propType.value);
        }
      } catch {}
    }

    memberProps.push(propValues);
  }

  if (memberProps.length < 2) {
    return undefined; // Need at least 2 object members
  }

  // Find property that exists in all members with unique literal values
  const firstMember = memberProps[0];
  for (const [propName, firstValue] of firstMember) {
    const values = new Set<string | number>([firstValue]);
    let isDiscriminator = true;

    for (let i = 1; i < memberProps.length; i++) {
      const value = memberProps[i].get(propName);
      if (value === undefined) {
        isDiscriminator = false;
        break;
      }
      if (values.has(value)) {
        // Duplicate value - not a valid discriminator
        isDiscriminator = false;
        break;
      }
      values.add(value);
    }

    if (isDiscriminator) {
      return propName;
    }
  }

  return undefined;
}

export function schemaIsAny(schema: string | Record<string, unknown>): boolean {
  if (typeof schema === 'string') {
    return schema === 'any';
  }

  if ('type' in schema && schema.type === 'any' && Object.keys(schema).length === 1) {
    return true;
  }

  return false;
}

export function schemasAreEqual(
  left: string | Record<string, unknown>,
  right: string | Record<string, unknown>,
): boolean {
  if (typeof left !== typeof right) {
    return false;
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }

  if (left == null || right == null) {
    return left === right;
  }

  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => normalize(item));
    }

    if (value && typeof value === 'object') {
      const sortedEntries = Object.entries(value)
        .map(([key, val]) => [key, normalize(val)] as const)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

      return Object.fromEntries(sortedEntries);
    }

    return value;
  };

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

/**
 * Remove duplicate schemas from an array while preserving order.
 * Uses deep equality comparison via schemasAreEqual.
 */
export function deduplicateSchemas(
  schemas: Array<string | Record<string, unknown>>,
): Array<string | Record<string, unknown>> {
  const result: Array<string | Record<string, unknown>> = [];
  for (const schema of schemas) {
    const isDuplicate = result.some((existing) => schemasAreEqual(existing, schema));
    if (!isDuplicate) {
      result.push(schema);
    }
  }
  return result;
}
