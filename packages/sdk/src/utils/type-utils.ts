import * as ts from 'typescript';

/**
 * Extract all type references from a type string
 * This helps us identify types that should be included in the types section
 */
export function extractTypeReferences(typeString: string): string[] {
  const references: string[] = [];
  
  // Match type references (word characters followed by optional generics)
  const typeRefPattern = /\b([A-Z][a-zA-Z0-9]*(?:<[^>]+>)?)\b/g;
  const matches = typeString.matchAll(typeRefPattern);
  
  for (const match of matches) {
    const typeName = match[1].split('<')[0]; // Remove generics
    
    // Skip primitive types and built-ins
    const builtIns = ['string', 'number', 'boolean', 'any', 'unknown', 'void', 
                      'undefined', 'null', 'never', 'object', 'Promise', 'Array',
                      'Map', 'Set', 'Date', 'RegExp', 'Error', 'Function',
                      'Uint8Array', 'ArrayBufferLike', 'ArrayBuffer'];
    
    if (!builtIns.includes(typeName) && !references.includes(typeName)) {
      references.push(typeName);
    }
  }
  
  return references;
}

/**
 * Check if a parameter is using object destructuring
 */
export function isDestructuredParameter(param: ts.ParameterDeclaration): boolean {
  return param.name && ts.isObjectBindingPattern(param.name);
}

/**
 * Get the properties from a destructured parameter
 */
export function getDestructuredProperties(
  param: ts.ParameterDeclaration,
  typeChecker: ts.TypeChecker
): Array<{ name: string; type: string; optional: boolean }> {
  if (!param.name || !ts.isObjectBindingPattern(param.name)) {
    return [];
  }

  const properties: Array<{ name: string; type: string; optional: boolean }> = [];
  const paramType = typeChecker.getTypeAtLocation(param);

  for (const element of param.name.elements) {
    if (ts.isBindingElement(element) && element.name && ts.isIdentifier(element.name)) {
      const propName = element.name.text;
      const propSymbol = paramType.getProperty(propName);
      
      if (propSymbol) {
        const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol, param);
        properties.push({
          name: propName,
          type: typeChecker.typeToString(propType),
          optional: !!element.initializer
        });
      }
    }
  }

  return properties;
}

/**
 * Collect all referenced types from a type and add them to the tracking set
 */
export function collectReferencedTypes(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  referencedTypes: Set<string>,
  visitedTypes: Set<ts.Type> = new Set()
): void {
  // Avoid infinite recursion
  if (visitedTypes.has(type)) return;
  visitedTypes.add(type);

  // Get the symbol for this type
  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();
    
    // Skip anonymous types (starts with __) and built-ins
    if (!symbolName.startsWith('__') && !isBuiltInType(symbolName)) {
      referencedTypes.add(symbolName);
    }
  }

  // Handle intersection types (A & B)
  if (type.isIntersection()) {
    for (const intersectionType of (type as ts.IntersectionType).types) {
      collectReferencedTypes(intersectionType, typeChecker, referencedTypes, visitedTypes);
    }
  }

  // Handle union types (A | B)
  if (type.isUnion()) {
    for (const unionType of (type as ts.UnionType).types) {
      collectReferencedTypes(unionType, typeChecker, referencedTypes, visitedTypes);
    }
  }

  // Handle generic type references
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (objectType.objectFlags & ts.ObjectFlags.Reference) {
      const typeRef = objectType as ts.TypeReference;
      if (typeRef.typeArguments) {
        for (const typeArg of typeRef.typeArguments) {
          collectReferencedTypes(typeArg, typeChecker, referencedTypes, visitedTypes);
        }
      }
    }
  }
}

export function isBuiltInType(name: string): boolean {
  const builtIns = [
    // Primitive types
    'string', 'number', 'boolean', 'bigint', 'symbol',
    'undefined', 'null',
    
    // Special types
    'any', 'unknown', 'never', 'void', 'object',
    
    // Built-in objects and constructors
    'Array', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Date', 'RegExp', 'Error', 'Function',
    'Object', 'String', 'Number', 'Boolean', 'BigInt', 'Symbol',
    
    // Typed arrays
    'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
    'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array',
    'BigInt64Array', 'BigUint64Array',
    'Uint8ClampedArray',
    
    // Array buffer related
    'ArrayBuffer', 'ArrayBufferLike', 'DataView',
    'Uint8ArrayConstructor', 'ArrayBufferConstructor',
    
    // Other built-ins
    'JSON', 'Math', 'Reflect', 'Proxy',
    'Intl', 'globalThis',
    
    // Special internal types
    '__type' // Anonymous types
  ];
  return builtIns.includes(name);
}