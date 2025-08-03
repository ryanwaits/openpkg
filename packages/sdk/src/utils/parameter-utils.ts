import * as ts from 'typescript';
import type { ParameterDocumentation, ParsedJSDoc } from './tsdoc-utils';
import { isBuiltInType } from './type-utils';

export interface StructuredProperty {
  name: string;
  type:
    | string
    | { $ref: string }
    | { type: string }
    | { anyOf: unknown[] }
    | { oneOf: unknown[] }
    | { enum: unknown[] };
  description?: string;
  optional?: boolean;
}

// Convert array of properties to OpenAPI-style object schema
export function propertiesToSchema(
  properties: StructuredProperty[],
  description?: string,
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
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

    if (prop.description) {
      propSchema.description = prop.description;
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
    schema.description = description;
  }

  return schema;
}

export interface TypeDefinition {
  properties?: Array<{
    name: string;
    type: string | Record<string, unknown>;
    optional?: boolean;
    description?: string;
  }>;
}

/**
 * Parse intersection types (A & B & C) into separate properties
 */
export function parseIntersectionType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
): StructuredProperty[] {
  const properties: StructuredProperty[] = [];

  if (!type.isIntersection()) {
    return properties;
  }

  const intersectionType = type as ts.IntersectionType;

  for (const subType of intersectionType.types) {
    const symbol = subType.getSymbol();

    if (symbol) {
      const typeName = symbol.getName();

      // Handle anonymous types (object literals)
      if (typeName.startsWith('__') && subType.getProperties().length > 0) {
        // This is an object literal, extract its properties
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
          });
        }
      } else if (typeRefs.has(typeName)) {
        // This is a named type, add as unnamed property with reference
        properties.push({
          name: '',
          type: { $ref: `#/types/${typeName}` },
        });
      }
    }
  }

  return properties;
}

/**
 * Format a type as either a string or a reference object
 * Following OpenAPI standards: use $ref for all named types
 */
export function formatTypeReference(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
): string | Record<string, unknown> {
  const typeString = typeChecker.typeToString(type);

  // Check if this is a primitive type
  const primitives = [
    'string',
    'number',
    'boolean',
    'bigint',
    'symbol',
    'any',
    'unknown',
    'void',
    'undefined',
    'null',
    'never',
  ];
  if (primitives.includes(typeString)) {
    // Convert to OpenAPI schema format
    if (typeString === 'bigint') {
      return { type: 'string', format: 'bigint' };
    }
    if (typeString === 'undefined' || typeString === 'null') {
      return { type: 'null' };
    }
    if (typeString === 'void' || typeString === 'never') {
      return { type: 'null' }; // Best approximation
    }
    return { type: typeString };
  }

  // Handle union types (e.g., "A | B | undefined")
  if (type.isUnion()) {
    const unionType = type as ts.UnionType;
    const parts = unionType.types.map((t) =>
      formatTypeReference(t, typeChecker, typeRefs, referencedTypes),
    );

    // Return as an anyOf array (OpenAPI style)
    return {
      anyOf: parts,
    };
  }

  // Check if this is a known type
  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();

    // Handle anonymous types (TypeScript uses __type, __object, etc. for anonymous types)
    if (symbolName.startsWith('__')) {
      // Try to expand anonymous types inline
      if (type.getFlags() & ts.TypeFlags.Object) {
        const properties = type.getProperties();
        if (properties.length > 0) {
          // Build inline object schema
          const objSchema: Record<string, unknown> = {
            type: 'object',
            properties: {},
          };
          const required: string[] = [];

          for (const prop of properties) {
            const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
            const propName = prop.getName();

            objSchema.properties[propName] = formatTypeReference(
              propType,
              typeChecker,
              typeRefs,
              referencedTypes,
            );

            if (!(prop.flags & ts.SymbolFlags.Optional)) {
              required.push(propName);
            }
          }

          if (required.length > 0) {
            objSchema.required = required;
          }

          return objSchema;
        }
      }
      // If we can't expand it, return a generic object
      return { type: 'object' };
    }
    // Check if this type is in our current package's types
    if (typeRefs.has(symbolName)) {
      return { $ref: `#/types/${symbolName}` };
    }

    // Add to referenced types for potential collection
    if (referencedTypes && !isBuiltInType(symbolName)) {
      referencedTypes.add(symbolName);
      return { $ref: `#/types/${symbolName}` };
    }

    // For built-in complex types
    if (symbolName === 'Array') {
      return { type: 'array' };
    }
    if (symbolName === 'Promise' || symbolName === 'Uint8Array') {
      return { type: symbolName };
    }

    // For types not in our package, still use $ref
    return { $ref: `#/types/${symbolName}` };
  }

  // Handle literal types (e.g., "mainnet")
  if (type.isLiteral()) {
    // TypeScript returns string literals with quotes, so we need to parse them
    if (typeString.startsWith('"') && typeString.endsWith('"')) {
      const literalValue = typeString.slice(1, -1); // Remove surrounding quotes
      return { enum: [literalValue] };
    }
    // Number literal
    return { enum: [Number(typeString)] };
  }

  // For complex types without symbols, parse the string to find references
  // This handles cases like "ClientOpts | undefined"
  const typePattern = /^(\w+)(\s*\|\s*undefined)?$/;
  const match = typeString.match(typePattern);
  if (match) {
    const [, typeName, hasUndefined] = match;
    if (typeRefs.has(typeName) || !isBuiltInType(typeName)) {
      if (hasUndefined) {
        return {
          anyOf: [{ $ref: `#/types/${typeName}` }, { type: 'null' }],
        };
      }
      return { $ref: `#/types/${typeName}` };
    }
  }

  // Default: return as complex type string
  return { type: typeString };
}

/**
 * Structure a parameter based on its type and TSDoc
 */
export function structureParameter(
  param: ts.Symbol,
  paramDecl: ts.ParameterDeclaration,
  paramType: ts.Type,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  functionDoc?: ParsedJSDoc | null,
  paramDoc?: ParameterDocumentation,
  referencedTypes?: Set<string>,
): Record<string, unknown> {
  const paramName = param.getName();

  // Check if this is an intersection type with an object literal
  if (paramType.isIntersection()) {
    const properties: StructuredProperty[] = [];
    const intersectionType = paramType as ts.IntersectionType;

    // Process each part of the intersection
    for (const subType of intersectionType.types) {
      const symbol = subType.getSymbol();
      const _typeString = typeChecker.typeToString(subType);

      if (!symbol || symbol.getName().startsWith('__')) {
        // This is an object literal - extract its properties
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);

          // Find TSDoc description for this property
          let description = '';
          if (functionDoc) {
            // Look for exact match first
            let docParam = functionDoc.params.find(
              (p) => p.name === `${paramName}.${prop.getName()}`,
            );

            // If parameter is __0 and no match found, try to find any param with this property
            if (!docParam && paramName === '__0') {
              docParam = functionDoc.params.find((p) => p.name.endsWith(`.${prop.getName()}`));
            }

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
      } else {
        // This is a named type in an intersection - we need to flatten its properties
        const _symbolName = symbol.getName();

        // Get the properties from this type and add them to our properties array
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);

          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            description: '',
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
          });
        }
      }
    }

    const actualName =
      paramName === '__0' && functionDoc ? getActualParamName(functionDoc) : paramName;
    return {
      name: actualName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      description: paramDoc?.description || '',
      schema: propertiesToSchema(properties),
    };
  }

  // Check if this is a union type with object literals
  if (paramType.isUnion()) {
    const unionType = paramType as ts.UnionType;
    const objectOptions: Array<{ properties: StructuredProperty[] }> = [];
    let hasNonObjectTypes = false;

    // Check each union member
    for (const subType of unionType.types) {
      const symbol = subType.getSymbol();

      // Check if this is an object literal
      if (!symbol || symbol.getName().startsWith('__')) {
        const properties: StructuredProperty[] = [];

        // Extract properties from the object literal
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);

          properties.push({
            name: prop.getName(),
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
      return {
        name: paramName,
        required: !typeChecker.isOptionalParameter(paramDecl),
        description: paramDoc?.description || '',
        schema: {
          oneOf: objectOptions.map((opt) => propertiesToSchema(opt.properties)),
        },
      };
    }
  }

  // Check if this is an inline object type
  const symbol = paramType.getSymbol();
  if (symbol?.getName().startsWith('__') && paramType.getProperties().length > 0) {
    // This is an inline object literal
    const properties: StructuredProperty[] = [];

    for (const prop of paramType.getProperties()) {
      const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);

      properties.push({
        name: prop.getName(),
        type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
        description: '',
        optional: !!(prop.flags & ts.SymbolFlags.Optional),
      });
    }

    return {
      name: paramName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      description: paramDoc?.description || '',
      schema: propertiesToSchema(properties),
    };
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

  return {
    name: paramName,
    required: !typeChecker.isOptionalParameter(paramDecl),
    description: paramDoc?.description || '',
    schema,
  };
}

/**
 * Get the actual parameter name from TSDoc when TypeScript shows __0
 */
function getActualParamName(functionDoc: ParsedJSDoc): string {
  // Find the first param that has destructured properties
  const docParam = functionDoc.params.find((p) => p.name.includes('.'));
  if (docParam) {
    return docParam.name.split('.')[0];
  }
  return '__0';
}
