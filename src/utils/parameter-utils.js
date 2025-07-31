import * as ts from 'typescript';
/**
 * Parse intersection types (A & B & C) into separate properties
 */
export function parseIntersectionType(type, typeChecker, typeRefs) {
    const properties = [];
    if (!type.isIntersection()) {
        return properties;
    }
    const intersectionType = type;
    for (const subType of intersectionType.types) {
        const symbol = subType.getSymbol();
        if (symbol) {
            const typeName = symbol.getName();
            // Handle anonymous types (object literals)
            if (typeName === '__type' && subType.getProperties().length > 0) {
                // This is an object literal, extract its properties
                for (const prop of subType.getProperties()) {
                    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
                    properties.push({
                        name: prop.getName(),
                        type: formatTypeReference(propType, typeChecker, typeRefs),
                        optional: !!(prop.flags & ts.SymbolFlags.Optional)
                    });
                }
            }
            else if (typeRefs.has(typeName)) {
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
export function formatTypeReference(type, typeChecker, typeRefs) {
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
export function structureParameter(param, paramDecl, paramType, typeChecker, typeRefs, functionDoc, paramDoc) {
    const paramName = param.getName();
    // Check if this is an intersection type with an object literal
    if (paramType.isIntersection()) {
        const properties = [];
        const intersectionType = paramType;
        // Process each part of the intersection
        for (const subType of intersectionType.types) {
            const symbol = subType.getSymbol();
            const typeString = typeChecker.typeToString(subType);
            if (!symbol || symbol.getName() === '__type') {
                // This is an object literal - extract its properties
                for (const prop of subType.getProperties()) {
                    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
                    // Find TSDoc description for this property
                    let description = '';
                    if (functionDoc) {
                        // Look for exact match first
                        let docParam = functionDoc.params.find(p => p.name === `${paramName}.${prop.getName()}`);
                        // If parameter is __0 and no match found, try to find any param with this property
                        if (!docParam && paramName === '__0') {
                            docParam = functionDoc.params.find(p => p.name.endsWith(`.${prop.getName()}`));
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
            }
            else {
                // This is a named type - add as unnamed property
                const symbolName = symbol.getName();
                // For intersection types, we need to understand if this adds required or optional properties
                // Since we can't determine this without deep analysis, we'll omit the optional field
                // and let consumers check the referenced type definition
                properties.push({
                    name: '',
                    type: { $ref: `#/types/${symbolName}` },
                    description: ''
                });
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
function getActualParamName(functionDoc) {
    // Find the first param that has destructured properties
    const docParam = functionDoc.params.find(p => p.name.includes('.'));
    if (docParam) {
        return docParam.name.split('.')[0];
    }
    return '__0';
}
