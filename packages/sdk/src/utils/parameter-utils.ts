/**
 * Parameter structuring utilities.
 * Main entry point for converting TypeScript parameters to structured schemas.
 */
import type * as TS from 'typescript';
import { type DecoratorInfo, extractParameterDecorators } from '../analysis/decorator-utils';
import { ts } from '../ts-module';
import type { ParameterDocumentation, ParsedJSDoc } from './tsdoc-utils';
import { isBuiltInType } from './type-utils';

export {
  buildSchemaFromTypeNode,
  isObjectLiteralType,
  isPureRefSchema,
  propertiesToSchema,
  type StructuredProperty,
  schemaIsAny,
  schemasAreEqual,
} from './schema-builder';
// Re-export from sub-modules for backwards compatibility
export { formatTypeReference } from './type-formatter';
export { getPropertyType, isInternalProperty } from './typebox-handler';

import {
  buildSchemaFromTypeNode,
  isObjectLiteralType,
  isPureRefSchema,
  propertiesToSchema,
  type StructuredProperty,
  schemaIsAny,
  schemasAreEqual,
} from './schema-builder';
// Import from sub-modules
import { formatTypeReference } from './type-formatter';
import { getPropertyType, isInternalProperty } from './typebox-handler';

export interface StructuredParameter {
  name: string;
  schema: ReturnType<typeof formatTypeReference>;
  description?: string;
  in?: 'query';
  required?: boolean;
  default?: unknown;
  rest?: boolean;
  decorators?: DecoratorInfo[];
}

/**
 * Structure a parameter based on its type and TSDoc
 */
export function structureParameter(
  param: ts.Symbol,
  paramDecl: TS.ParameterDeclaration,
  paramType: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  functionDoc?: ParsedJSDoc | null,
  paramDoc?: ParameterDocumentation,
  referencedTypes?: Set<string>,
): StructuredParameter {
  const paramName = param.getName();
  const isDestructured =
    paramName === '__0' ||
    ts.isObjectBindingPattern(paramDecl.name) ||
    ts.isArrayBindingPattern(paramDecl.name);

  let inferredAlias: string | undefined;
  if (isDestructured && functionDoc && Array.isArray(functionDoc.params)) {
    const prefixes = functionDoc.params
      .map((p) => p?.name)
      .filter((n): n is string => typeof n === 'string' && n.includes('.'))
      .map((n) => n.split('.', 2)[0])
      .filter(Boolean);
    if (prefixes.length > 0) {
      const counts = new Map<string, number>();
      for (const px of prefixes) counts.set(px, (counts.get(px) ?? 0) + 1);
      inferredAlias = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    }
  }

  const fallbackName = isDestructured ? (inferredAlias ?? 'options') : paramName;
  const docDescription = paramDoc?.description?.trim();

  // Check if this is an intersection type with an object literal
  if (paramType.isIntersection()) {
    const properties: StructuredProperty[] = [];
    const intersectionType = paramType as TS.IntersectionType;

    // Process each part of the intersection
    for (const subType of intersectionType.types) {
      const symbol = subType.getSymbol();
      const _typeString = typeChecker.typeToString(subType);

      const isAnonymousObject = isObjectLiteralType(subType) || symbol?.getName().startsWith('__');

      if (isAnonymousObject) {
        // This is an object literal - extract its properties
        for (const prop of subType.getProperties()) {
          const propName = prop.getName();

          if (isInternalProperty(propName)) {
            continue;
          }

          const propType = getPropertyType(prop, subType, typeChecker);

          // Find TSDoc description for this property
          let description = '';
          if (functionDoc) {
            // Try multiple matching strategies for destructured param TSDoc
            const docParam = functionDoc.params.find(
              (p) =>
                // Exact match with original param name
                p.name === `${paramName}.${propName}` ||
                // Match with inferred alias (e.g., opts.name when @param opts.name)
                (inferredAlias && p.name === `${inferredAlias}.${propName}`) ||
                // Fallback: any param ending with .propName (for __0 cases)
                (paramName.match(/^__\d+$/) && p.name.endsWith(`.${propName}`)),
            );

            if (docParam) {
              description = docParam.description;
            }
          }

          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            description,
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
          });
        }
      } else if (symbol) {
        // This is a named type in an intersection - we need to flatten its properties
        const _symbolName = symbol.getName();

        // Get the properties from this type and add them to our properties array
        if (!isBuiltInType(_symbolName)) {
          for (const prop of subType.getProperties()) {
            const propName = prop.getName();

            if (isInternalProperty(propName)) {
              continue;
            }

            const propType = getPropertyType(prop, subType, typeChecker);

            properties.push({
              name: propName,
              type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
              description: '',
              optional: !!(prop.flags & ts.SymbolFlags.Optional),
            });
          }
        }
      }
    }

    const actualName = fallbackName;
    const out: StructuredParameter = {
      name: actualName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      schema: propertiesToSchema(properties),
    };
    if (docDescription) {
      out.description = docDescription;
    }
    return out;
  }

  // Check if this is a union type with object literals
  if (paramType.isUnion()) {
    const unionType = paramType as TS.UnionType;
    const objectOptions: Array<{ properties: StructuredProperty[] }> = [];
    let hasNonObjectTypes = false;

    // Check each union member
    for (const subType of unionType.types) {
      const symbol = subType.getSymbol();

      // Check if this is an object literal
      if (isObjectLiteralType(subType) || symbol?.getName().startsWith('__')) {
        const properties: StructuredProperty[] = [];

        // Extract properties from the object literal
        for (const prop of subType.getProperties()) {
          const propName = prop.getName();

          if (isInternalProperty(propName)) {
            continue;
          }

          const propType = getPropertyType(prop, subType, typeChecker);

          properties.push({
            name: propName,
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            description: '',
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
          });
        }

        if (properties.length > 0) {
          objectOptions.push({ properties });
        }
      } else {
        // This is a named type, not an object literal
        hasNonObjectTypes = true;
      }
    }

    // If all union members are object literals, structure with oneOf
    if (objectOptions.length > 0 && !hasNonObjectTypes) {
      const readableName = fallbackName;
      const out: StructuredParameter = {
        name: readableName,
        required: !typeChecker.isOptionalParameter(paramDecl),
        schema: {
          oneOf: objectOptions.map((opt) => propertiesToSchema(opt.properties)),
        },
      };
      if (docDescription) {
        out.description = docDescription;
      }
      return out;
    }
  }

  // Check if this is an inline object type
  // Skip inline expansion if the type has a named alias - use $ref instead
  const symbol = paramType.getSymbol();
  const hasNamedAlias = paramType.aliasSymbol && !paramType.aliasSymbol.getName().startsWith('__');
  if (
    !hasNamedAlias &&
    (symbol?.getName().startsWith('__') || isObjectLiteralType(paramType)) &&
    paramType.getProperties().length > 0
  ) {
    // This is an inline object literal
    const properties: StructuredProperty[] = [];

    for (const prop of paramType.getProperties()) {
      const propName = prop.getName();

      if (isInternalProperty(propName)) {
        continue;
      }

      const propType = getPropertyType(prop, paramType, typeChecker);

      properties.push({
        name: propName,
        type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
        description: '',
        optional: !!(prop.flags & ts.SymbolFlags.Optional),
      });
    }

    const readableName = fallbackName;
    const out: StructuredParameter = {
      name: readableName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      schema: propertiesToSchema(properties),
    };
    if (docDescription) {
      out.description = docDescription;
    }
    return out;
  }

  // Fallback for remote analysis when type checker returns `any` but the parameter has a declared TypeNode.
  if (
    paramType.flags & ts.TypeFlags.Any &&
    paramDecl.type &&
    paramDecl.name &&
    ts.isObjectBindingPattern(paramDecl.name)
  ) {
    const actualName = fallbackName;
    const schema = buildSchemaFromTypeNode(
      paramDecl.type,
      typeChecker,
      typeRefs,
      referencedTypes,
      functionDoc ?? null,
      param.getName(),
    );

    const out: StructuredParameter = {
      name: actualName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      schema,
    };
    if (docDescription) {
      out.description = docDescription;
    }
    return out;
  }

  // Handle regular parameters
  const typeRef = formatTypeReference(paramType, typeChecker, typeRefs, referencedTypes);
  let schema: string | Record<string, unknown>;

  if (typeof typeRef === 'string') {
    // Primitive or simple type
    if (
      [
        'string',
        'number',
        'boolean',
        'null',
        'undefined',
        'any',
        'unknown',
        'never',
        'void',
      ].includes(typeRef)
    ) {
      schema = { type: typeRef };
    } else {
      // Complex type string (e.g., "Array<string>", "Promise<T>")
      schema = { type: typeRef };
    }
  } else {
    // Already a schema object ($ref, anyOf, etc.)
    schema = typeRef;
  }

  if (paramDecl.type) {
    const astSchema = buildSchemaFromTypeNode(
      paramDecl.type,
      typeChecker,
      typeRefs,
      referencedTypes,
      functionDoc ?? null,
      param.getName(),
    );

    if (schemaIsAny(schema)) {
      schema = astSchema;
    } else if (
      !('type' in schema && schema.type === 'any') &&
      !(typeof schema === 'object' && isPureRefSchema(schema as Record<string, unknown>)) &&
      Object.keys(astSchema).length > 0 &&
      !schemasAreEqual(schema, astSchema)
    ) {
      schema = {
        allOf: [schema, astSchema],
      };
    }
  }

  const readableName = fallbackName;
  const out: StructuredParameter = {
    name: readableName,
    required: !typeChecker.isOptionalParameter(paramDecl),
    schema,
  };
  if (docDescription) {
    out.description = docDescription;
  }

  // Extract default value if present
  if (paramDecl.initializer) {
    const defaultText = paramDecl.initializer.getText();
    // Try to parse literal values
    if (ts.isStringLiteral(paramDecl.initializer)) {
      out.default = paramDecl.initializer.text;
    } else if (ts.isNumericLiteral(paramDecl.initializer)) {
      out.default = Number(paramDecl.initializer.text);
    } else if (
      paramDecl.initializer.kind === ts.SyntaxKind.TrueKeyword ||
      paramDecl.initializer.kind === ts.SyntaxKind.FalseKeyword
    ) {
      out.default = paramDecl.initializer.kind === ts.SyntaxKind.TrueKeyword;
    } else if (paramDecl.initializer.kind === ts.SyntaxKind.NullKeyword) {
      out.default = null;
    } else {
      // For complex expressions, keep as string
      out.default = defaultText;
    }
  }

  // Mark rest parameters (...args)
  if (paramDecl.dotDotDotToken) {
    out.rest = true;
  }

  // Extract parameter decorators
  const decorators = extractParameterDecorators(paramDecl);
  if (decorators) {
    out.decorators = decorators;
  }

  return out;
}
