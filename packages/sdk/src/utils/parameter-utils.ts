import * as ts from 'typescript';
import type { ParameterDocumentation, ParsedJSDoc } from './tsdoc-utils';
import { isBuiltInType } from './type-utils';

const BUILTIN_TYPE_SCHEMAS: Record<string, Record<string, unknown>> = {
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

function isPureRefSchema(value: Record<string, unknown>): value is { $ref: string } {
  return Object.keys(value).length === 1 && '$ref' in value;
}

function withDescription(
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

function buildSchemaFromTypeNode(
  node: ts.TypeNode,
  typeChecker: ts.TypeChecker,
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
      functionDoc,
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
        const formatted = formatTypeReference(memberType, typeChecker, typeRefs, referencedTypes);

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

  // Fallback: return textual representation
  return { type: node.getText() };
}

function getDocDescriptionForProperty(
  functionDoc: ParsedJSDoc | null,
  parentParamName: string,
  propName: string,
): string | undefined {
  if (!functionDoc) {
    return undefined;
  }

  let match = functionDoc.params.find((p) => p.name === `${parentParamName}.${propName}`);
  if (!match) {
    match = functionDoc.params.find((p) => p.name.endsWith(`.${propName}`));
  }
  return match?.description;
}

function schemaIsAny(schema: string | Record<string, unknown>): boolean {
  if (typeof schema === 'string') {
    return schema === 'any';
  }

  if ('type' in schema && schema.type === 'any' && Object.keys(schema).length === 1) {
    return true;
  }

  return false;
}

function schemasAreEqual(
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
 * Format a type as either a string or a reference object
 * Following OpenAPI standards: use $ref for all named types
 */
export function formatTypeReference(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
): string | Record<string, unknown> {
  const aliasSymbol = type.aliasSymbol;
  if (aliasSymbol) {
    const aliasName = aliasSymbol.getName();
    if (typeRefs.has(aliasName)) {
      return { $ref: `#/types/${aliasName}` };
    }
    if (referencedTypes && !isBuiltInType(aliasName)) {
      referencedTypes.add(aliasName);
      return { $ref: `#/types/${aliasName}` };
    }
  }

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

    // For built-in complex types
    if (symbolName === 'Array') {
      return { type: 'array' };
    }
    const builtInSchema = BUILTIN_TYPE_SCHEMAS[symbolName];
    if (builtInSchema) {
      return { ...builtInSchema };
    }

    // Add to referenced types for potential collection
    if (referencedTypes && !isBuiltInType(symbolName)) {
      referencedTypes.add(symbolName);
      return { $ref: `#/types/${symbolName}` };
    }

    if (isBuiltInType(symbolName)) {
      return { type: 'object' };
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
      paramName === '__0' ? (functionDoc ? getActualParamName(functionDoc) : 'options') : paramName;
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
      const readableName = paramName === '__0' ? 'options' : paramName;
      return {
        name: readableName,
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

    const readableName = paramName === '__0' ? 'options' : paramName;
    return {
      name: readableName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      description: paramDoc?.description || '',
      schema: propertiesToSchema(properties),
    };
  }

  // Fallback for remote analysis when type checker returns `any` but the parameter has a declared TypeNode.
  if (
    paramType.flags & ts.TypeFlags.Any &&
    paramDecl.type &&
    paramDecl.name &&
    ts.isObjectBindingPattern(paramDecl.name)
  ) {
    const actualName = paramName === '__0' ? 'options' : paramName;
    const schema = buildSchemaFromTypeNode(
      paramDecl.type,
      typeChecker,
      typeRefs,
      referencedTypes,
      functionDoc,
      param.getName(),
    );

    return {
      name: actualName,
      required: !typeChecker.isOptionalParameter(paramDecl),
      description: paramDoc?.description || '',
      schema,
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

  if (paramDecl.type) {
    const astSchema = buildSchemaFromTypeNode(
      paramDecl.type,
      typeChecker,
      typeRefs,
      referencedTypes,
      functionDoc,
      param.getName(),
    );

    if (schemaIsAny(schema)) {
      schema = astSchema;
    } else if (Object.keys(astSchema).length > 0 && !schemasAreEqual(schema, astSchema)) {
      schema = {
        allOf: [schema, astSchema],
      };
    }
  }

  const readableName = paramName === '__0' ? 'options' : paramName;
  return {
    name: readableName,
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
