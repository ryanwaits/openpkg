import * as ts from 'typescript';
import { ParsedJSDoc } from './tsdoc-utils';
import { isBuiltInType } from './type-utils';

export interface StructuredProperty {
  name: string;
  type: any; // Can be string or { $ref: string }
  description?: string;
  optional?: boolean;
}

export interface TypeDefinition {
  properties?: Array<{
    name: string;
    type: any;
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
  typeRefs: Map<string, string>
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
      if (typeName === '__type' && subType.getProperties().length > 0) {
        // This is an object literal, extract its properties
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            optional: !!(prop.flags & ts.SymbolFlags.Optional)
          });
        }
      } else if (typeRefs.has(typeName)) {
        // This is a named type, add as unnamed property with reference
        properties.push({
          name: '',
          type: { $ref: `#/types/${typeName}` }
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
  referencedTypes?: Set<string>
): any {
  const typeString = typeChecker.typeToString(type);
  
  // Check if this is a primitive type
  const primitives = ['string', 'number', 'boolean', 'any', 'unknown', 'void', 'undefined', 'null', 'never'];
  if (primitives.includes(typeString)) {
    return typeString;
  }
  
  // Handle union types (e.g., "A | B | undefined")
  if (type.isUnion()) {
    const unionType = type as ts.UnionType;
    const parts = unionType.types.map(t => 
      formatTypeReference(t, typeChecker, typeRefs, referencedTypes)
    );
    
    // If all parts are strings, join them
    if (parts.every(p => typeof p === 'string')) {
      return parts.join(' | ');
    }
    
    // Otherwise, return as an anyOf array (OpenAPI style)
    return {
      anyOf: parts
    };
  }
  
  // Check if this is a known type
  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();
    
    // Skip anonymous types
    if (symbolName !== '__type') {
      // Check if this type is in our current package's types
      if (typeRefs.has(symbolName)) {
        return { $ref: `#/types/${symbolName}` };
      }
      
      // Add to referenced types for potential collection
      if (referencedTypes && !isBuiltInType(symbolName)) {
        referencedTypes.add(symbolName);
      }
      
      // For types not in our package, return the string to avoid broken refs
      // This includes imported types from other packages
      return symbolName;
    }
  }
  
  // Handle literal types (e.g., "mainnet")
  if (type.isLiteral()) {
    // TypeScript returns string literals with quotes, so we need to parse them
    if (typeString.startsWith('"') && typeString.endsWith('"')) {
      return typeString.slice(1, -1); // Remove surrounding quotes
    }
    return typeString;
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
          anyOf: [
            { $ref: `#/types/${typeName}` },
            'undefined'
          ]
        };
      }
      return { $ref: `#/types/${typeName}` };
    }
  }
  
  // Default: return as string
  return typeString;
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
  paramDoc?: any,
  referencedTypes?: Set<string>
): any {
  const paramName = param.getName();
  
  // Check if this is an intersection type with an object literal
  if (paramType.isIntersection()) {
    const properties: StructuredProperty[] = [];
    const intersectionType = paramType as ts.IntersectionType;
    
    // Process each part of the intersection
    for (const subType of intersectionType.types) {
      const symbol = subType.getSymbol();
      const typeString = typeChecker.typeToString(subType);
      
      if (!symbol || symbol.getName() === '__type') {
        // This is an object literal - extract its properties
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
          
          // Find TSDoc description for this property
          let description = '';
          if (functionDoc) {
            // Look for exact match first
            let docParam = functionDoc.params.find(p => 
              p.name === `${paramName}.${prop.getName()}`
            );
            
            // If parameter is __0 and no match found, try to find any param with this property
            if (!docParam && paramName === '__0') {
              docParam = functionDoc.params.find(p => 
                p.name.endsWith(`.${prop.getName()}`)
              );
            }
            
            if (docParam) {
              description = docParam.description;
            }
          }
          
          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            description,
            optional: !!(prop.flags & ts.SymbolFlags.Optional)
          });
        }
      } else {
        // This is a named type in an intersection - we need to flatten its properties
        const symbolName = symbol.getName();
        
        // Get the properties from this type and add them to our properties array
        for (const prop of subType.getProperties()) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
          
          properties.push({
            name: prop.getName(),
            type: formatTypeReference(propType, typeChecker, typeRefs, referencedTypes),
            description: '',
            optional: !!(prop.flags & ts.SymbolFlags.Optional)
          });
        }
      }
    }
    
    return {
      name: paramName === '__0' && functionDoc ? getActualParamName(functionDoc) : paramName,
      type: 'object',
      properties,
      optional: typeChecker.isOptionalParameter(paramDecl),
      description: paramDoc?.description || ''
    };
  }
  
  // Handle regular parameters
  return {
    name: paramName,
    type: formatTypeReference(paramType, typeChecker, typeRefs),
    optional: typeChecker.isOptionalParameter(paramDecl),
    description: paramDoc?.description || ''
  };
}

/**
 * Get the actual parameter name from TSDoc when TypeScript shows __0
 */
function getActualParamName(functionDoc: ParsedJSDoc): string {
  // Find the first param that has destructured properties
  const docParam = functionDoc.params.find(p => p.name.includes('.'));
  if (docParam) {
    return docParam.name.split('.')[0];
  }
  return '__0';
}