import * as ts from 'typescript';
import { ParsedJSDoc } from './tsdoc-utils';

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
            type: formatTypeReference(propType, typeChecker, typeRefs),
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
 */
export function formatTypeReference(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>
): any {
  const typeString = typeChecker.typeToString(type);
  
  // Check if this is a known type
  const symbol = type.getSymbol();
  if (symbol && typeRefs.has(symbol.getName())) {
    return { $ref: `#/types/${typeRefs.get(symbol.getName())}` };
  }
  
  // Check for common patterns in type string
  if (typeRefs.size > 0) {
    for (const [typeName, typeId] of typeRefs.entries()) {
      if (typeString === typeName || typeString.startsWith(typeName + '<')) {
        return { $ref: `#/types/${typeId}` };
      }
    }
  }
  
  // Return as string for primitives and complex types
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
  paramDoc?: any
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
            type: formatTypeReference(propType, typeChecker, typeRefs),
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
            type: formatTypeReference(propType, typeChecker, typeRefs),
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