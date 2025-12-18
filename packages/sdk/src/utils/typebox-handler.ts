/**
 * TypeBox schema type handling.
 * Converts TypeBox schema types (TObject, TArray, TUnion, etc.) to JSON Schema.
 */
import type * as TS from 'typescript';
import { ts } from '../ts-module';
import { DEFAULT_MAX_TYPE_DEPTH } from '../options';

/**
 * TypeBox primitive type mappings to JSON Schema
 */
export const TYPEBOX_PRIMITIVE_MAP: Record<string, Record<string, unknown>> = {
  TString: { type: 'string' },
  TNumber: { type: 'number' },
  TBoolean: { type: 'boolean' },
  TInteger: { type: 'integer' },
  TNull: { type: 'null' },
  TAny: {},
  TUnknown: {},
  TNever: { not: {} },
  TVoid: { type: 'null' },
  TUndefined: { type: 'null' },
};

/**
 * Check if a symbol name matches TypeBox schema type pattern (T* prefix)
 */
export function isTypeBoxSchemaType(symbolName: string): boolean {
  return /^T[A-Z][a-zA-Z]*$/.test(symbolName);
}

/**
 * Check if a property name matches TypeBox internal symbol pattern (starts with __@)
 */
export function isInternalProperty(name: string): boolean {
  return name.startsWith('__@');
}

/**
 * Check if a type is a TypeBox OptionalKind marker object
 * These have a single property matching __@OptionalKind@XX
 */
export function isTypeBoxOptionalMarker(type: TS.Type): boolean {
  const props = type.getProperties();
  if (props.length !== 1) return false;
  return isInternalProperty(props[0].getName());
}

/**
 * Unwrap TypeBox optional intersection and detect optionality
 * Returns { innerTypes, isOptional } where innerTypes excludes OptionalKind marker
 */
export function unwrapTypeBoxOptional(type: TS.Type): { innerTypes: TS.Type[]; isOptional: boolean } {
  if (!type.isIntersection()) {
    return { innerTypes: [type], isOptional: false };
  }

  const intersectionType = type as TS.IntersectionType;
  const filtered = intersectionType.types.filter((t) => !isTypeBoxOptionalMarker(t));
  const hadMarker = filtered.length < intersectionType.types.length;

  return { innerTypes: filtered, isOptional: hadMarker };
}

/**
 * Safely get the type of a property symbol.
 * Handles computed types (TypeBox Static<>, Zod infer<>, etc.) where
 * valueDeclaration may be undefined.
 */
export function getPropertyType(
  prop: TS.Symbol,
  parentType: TS.Type,
  typeChecker: TS.TypeChecker,
): TS.Type {
  // Preferred: use valueDeclaration when available
  if (prop.valueDeclaration) {
    return typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
  }

  // Fallback for computed/conditional types
  const propType = typeChecker.getTypeOfPropertyOfType(parentType, prop.getName());
  if (propType) {
    return propType;
  }

  // Last resort: try any declaration
  const decl = prop.declarations?.[0];
  if (decl) {
    return typeChecker.getTypeOfSymbolAtLocation(prop, decl);
  }

  // Give up - return any
  return typeChecker.getAnyType();
}

/**
 * Format type reference - forward declaration to avoid circular dependency.
 * This gets set by the main parameter-utils module.
 */
export type FormatTypeReferenceFn = (
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
  visitedAliases?: Set<string>,
  depth?: number,
  maxDepth?: number,
  visitedTypeIds?: Set<number>,
) => string | Record<string, unknown>;

let _formatTypeReference: FormatTypeReferenceFn | null = null;

export function setFormatTypeReference(fn: FormatTypeReferenceFn): void {
  _formatTypeReference = fn;
}

function formatTypeReferenceInternal(
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string> | undefined,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  typeIds?: Set<number>,
): string | Record<string, unknown> {
  if (_formatTypeReference) {
    return _formatTypeReference(
      type,
      typeChecker,
      typeRefs,
      referencedTypes,
      visited,
      depth,
      maxDepth,
      typeIds,
    );
  }
  // Fallback - should not happen in normal usage
  return { type: 'object' };
}

/**
 * Extract JSON Schema from TypeBox schema types (TObject, TArray, TUnion, etc.)
 * Returns null if the type cannot be converted.
 */
export function formatTypeBoxSchema(
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string> | undefined,
  visited: Set<string>,
  depth = 0,
  maxDepth: number = DEFAULT_MAX_TYPE_DEPTH,
  typeIds?: Set<number>,
): Record<string, unknown> | null {
  // Guard against infinite recursion
  if (depth > maxDepth) {
    return { type: 'unknown' };
  }
  const symbol = type.getSymbol();
  if (!symbol) return null;

  const symbolName = symbol.getName();

  // Check for primitive TypeBox types
  if (TYPEBOX_PRIMITIVE_MAP[symbolName]) {
    return { ...TYPEBOX_PRIMITIVE_MAP[symbolName] };
  }

  // Get type arguments for generic TypeBox types
  const objectType = type as TS.ObjectType;
  if (!(objectType.objectFlags & ts.ObjectFlags.Reference)) {
    return null;
  }

  const typeRef = type as TS.TypeReference;
  const typeArgs = typeRef.typeArguments;

  switch (symbolName) {
    case 'TObject': {
      // TObject<Props> - extract properties from first type argument
      if (!typeArgs || typeArgs.length === 0) {
        return { type: 'object' };
      }
      const propsType = typeArgs[0];
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const prop of propsType.getProperties()) {
        const propName = prop.getName();

        if (isInternalProperty(propName)) {
          continue;
        }

        const propType = getPropertyType(prop, propsType, typeChecker);
        const propSymbol = propType.getSymbol();
        const propSymbolName = propSymbol?.getName();

        // Check if this property references another exported schema variable
        if (propSymbolName && typeRefs.has(propSymbolName)) {
          properties[propName] = { $ref: `#/types/${propSymbolName}` };
        } else if (propSymbolName && isTypeBoxSchemaType(propSymbolName)) {
          // Recursively format nested TypeBox schemas
          const nested = formatTypeBoxSchema(
            propType,
            typeChecker,
            typeRefs,
            referencedTypes,
            visited,
            depth + 1,
            maxDepth,
            typeIds,
          );
          properties[propName] = nested ?? { type: 'object' };
        } else {
          // Use standard formatTypeReference for non-TypeBox types
          properties[propName] = formatTypeReferenceInternal(
            propType,
            typeChecker,
            typeRefs,
            referencedTypes,
            visited,
            depth + 1,
            maxDepth,
            typeIds,
          );
        }

        // Check if property is optional (wrapped in TOptional or intersection with OptionalKind)
        const { isOptional } = unwrapTypeBoxOptional(propType);
        if (propSymbolName !== 'TOptional' && !isOptional) {
          required.push(propName);
        }
      }

      const schema: Record<string, unknown> = { type: 'object', properties };
      if (required.length > 0) {
        schema.required = required;
      }
      return schema;
    }

    case 'TArray': {
      // TArray<T> - extract items type from first type argument
      if (!typeArgs || typeArgs.length === 0) {
        return { type: 'array' };
      }
      const itemType = typeArgs[0];
      const itemSymbol = itemType.getSymbol();
      const itemSymbolName = itemSymbol?.getName();

      let items: unknown;
      if (itemSymbolName && typeRefs.has(itemSymbolName)) {
        items = { $ref: `#/types/${itemSymbolName}` };
      } else if (itemSymbolName && isTypeBoxSchemaType(itemSymbolName)) {
        items = formatTypeBoxSchema(
          itemType,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        ) ?? {
          type: 'object',
        };
      } else {
        items = formatTypeReferenceInternal(
          itemType,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        );
      }

      return { type: 'array', items };
    }

    case 'TUnion': {
      // TUnion<[A, B, ...]> - extract union members from tuple type argument
      if (!typeArgs || typeArgs.length === 0) {
        return { anyOf: [] };
      }
      const tupleType = typeArgs[0];
      const members: unknown[] = [];

      if (tupleType.isUnion()) {
        for (const memberType of (tupleType as TS.UnionType).types) {
          const memberSymbol = memberType.getSymbol();
          const memberSymbolName = memberSymbol?.getName();

          if (memberSymbolName && typeRefs.has(memberSymbolName)) {
            members.push({ $ref: `#/types/${memberSymbolName}` });
          } else if (memberSymbolName && isTypeBoxSchemaType(memberSymbolName)) {
            members.push(
              formatTypeBoxSchema(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ) ?? {
                type: 'object',
              },
            );
          } else {
            members.push(
              formatTypeReferenceInternal(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ),
            );
          }
        }
      } else if ((tupleType as TS.TypeReference).typeArguments) {
        // Handle tuple representation
        for (const memberType of (tupleType as TS.TypeReference).typeArguments!) {
          const memberSymbol = memberType.getSymbol();
          const memberSymbolName = memberSymbol?.getName();

          if (memberSymbolName && typeRefs.has(memberSymbolName)) {
            members.push({ $ref: `#/types/${memberSymbolName}` });
          } else if (memberSymbolName && isTypeBoxSchemaType(memberSymbolName)) {
            members.push(
              formatTypeBoxSchema(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ) ?? {
                type: 'object',
              },
            );
          } else {
            members.push(
              formatTypeReferenceInternal(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ),
            );
          }
        }
      }

      return { anyOf: members };
    }

    case 'TIntersect': {
      // TIntersect<[A, B, ...]> - extract intersection members
      if (!typeArgs || typeArgs.length === 0) {
        return { allOf: [] };
      }
      const tupleType = typeArgs[0];
      const members: unknown[] = [];

      if ((tupleType as TS.TypeReference).typeArguments) {
        for (const memberType of (tupleType as TS.TypeReference).typeArguments!) {
          const memberSymbol = memberType.getSymbol();
          const memberSymbolName = memberSymbol?.getName();

          if (memberSymbolName && typeRefs.has(memberSymbolName)) {
            members.push({ $ref: `#/types/${memberSymbolName}` });
          } else if (memberSymbolName && isTypeBoxSchemaType(memberSymbolName)) {
            members.push(
              formatTypeBoxSchema(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ) ?? {
                type: 'object',
              },
            );
          } else {
            members.push(
              formatTypeReferenceInternal(
                memberType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ),
            );
          }
        }
      }

      return { allOf: members };
    }

    case 'TOptional': {
      // TOptional<T> - unwrap and mark as optional (handled at property level)
      if (!typeArgs || typeArgs.length === 0) {
        return {};
      }
      const innerType = typeArgs[0];
      const innerSymbol = innerType.getSymbol();
      const innerSymbolName = innerSymbol?.getName();

      if (innerSymbolName && typeRefs.has(innerSymbolName)) {
        return { $ref: `#/types/${innerSymbolName}` };
      } else if (innerSymbolName && isTypeBoxSchemaType(innerSymbolName)) {
        return (
          formatTypeBoxSchema(
            innerType,
            typeChecker,
            typeRefs,
            referencedTypes,
            visited,
            depth + 1,
            maxDepth,
            typeIds,
          ) ?? {
            type: 'object',
          }
        );
      }
      return formatTypeReferenceInternal(
        innerType,
        typeChecker,
        typeRefs,
        referencedTypes,
        visited,
        depth + 1,
        maxDepth,
        typeIds,
      ) as Record<string, unknown>;
    }

    case 'TLiteral': {
      // TLiteral<'value'> - extract literal value from type argument
      if (!typeArgs || typeArgs.length === 0) {
        return { enum: [] };
      }
      const literalType = typeArgs[0];
      if (literalType.isLiteral()) {
        const value = (literalType as TS.LiteralType).value;
        return { enum: [value] };
      }
      // Fallback: use typeToString
      const literalStr = typeChecker.typeToString(literalType);
      if (literalStr.startsWith('"') && literalStr.endsWith('"')) {
        return { enum: [literalStr.slice(1, -1)] };
      }
      return { enum: [literalStr] };
    }

    case 'TRecord': {
      // TRecord<K, V> - additionalProperties schema
      if (!typeArgs || typeArgs.length < 2) {
        return { type: 'object', additionalProperties: true };
      }
      const valueType = typeArgs[1];
      const valueSymbol = valueType.getSymbol();
      const valueSymbolName = valueSymbol?.getName();

      let additionalProperties: unknown;
      if (valueSymbolName && typeRefs.has(valueSymbolName)) {
        additionalProperties = { $ref: `#/types/${valueSymbolName}` };
      } else if (valueSymbolName && isTypeBoxSchemaType(valueSymbolName)) {
        additionalProperties =
          formatTypeBoxSchema(
            valueType,
            typeChecker,
            typeRefs,
            referencedTypes,
            visited,
            depth + 1,
            maxDepth,
            typeIds,
          ) ?? true;
      } else {
        additionalProperties = formatTypeReferenceInternal(
          valueType,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        );
      }

      return { type: 'object', additionalProperties };
    }

    case 'TRef': {
      // TRef<T> - reference to another schema
      if (!typeArgs || typeArgs.length === 0) {
        return { $ref: '#/types/unknown' };
      }
      const refType = typeArgs[0];
      const refSymbol = refType.getSymbol();
      const refSymbolName = refSymbol?.getName();

      if (refSymbolName) {
        return { $ref: `#/types/${refSymbolName}` };
      }
      return { type: 'object' };
    }

    default:
      // Unknown TypeBox type - return null to fall back to default handling
      return null;
  }
}
