import * as ts from 'typescript';
/**
 * Extract all type references from a type string
 * This helps us identify types that should be included in the types section
 */
export function extractTypeReferences(typeString) {
    const references = [];
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
export function isDestructuredParameter(param) {
    return param.name && ts.isObjectBindingPattern(param.name);
}
/**
 * Get the properties from a destructured parameter
 */
export function getDestructuredProperties(param, typeChecker) {
    if (!param.name || !ts.isObjectBindingPattern(param.name)) {
        return [];
    }
    const properties = [];
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
export function collectReferencedTypes(type, typeChecker, referencedTypes, visitedTypes = new Set()) {
    // Avoid infinite recursion
    if (visitedTypes.has(type))
        return;
    visitedTypes.add(type);
    // Get the symbol for this type
    const symbol = type.getSymbol();
    if (symbol) {
        const symbolName = symbol.getName();
        // Skip anonymous types and built-ins
        if (symbolName !== '__type' && !isBuiltInType(symbolName)) {
            referencedTypes.add(symbolName);
        }
    }
    // Handle intersection types (A & B)
    if (type.isIntersection()) {
        for (const intersectionType of type.types) {
            collectReferencedTypes(intersectionType, typeChecker, referencedTypes, visitedTypes);
        }
    }
    // Handle union types (A | B)
    if (type.isUnion()) {
        for (const unionType of type.types) {
            collectReferencedTypes(unionType, typeChecker, referencedTypes, visitedTypes);
        }
    }
    // Handle generic type references
    if (type.flags & ts.TypeFlags.Object) {
        const objectType = type;
        if (objectType.objectFlags & ts.ObjectFlags.Reference) {
            const typeRef = objectType;
            if (typeRef.typeArguments) {
                for (const typeArg of typeRef.typeArguments) {
                    collectReferencedTypes(typeArg, typeChecker, referencedTypes, visitedTypes);
                }
            }
        }
    }
}
function isBuiltInType(name) {
    const builtIns = [
        'string', 'number', 'boolean', 'any', 'unknown', 'void',
        'undefined', 'null', 'never', 'object', 'Promise', 'Array',
        'Map', 'Set', 'Date', 'RegExp', 'Error', 'Function',
        'Uint8Array', 'ArrayBufferLike', 'ArrayBuffer', 'Uint8ArrayConstructor'
    ];
    return builtIns.includes(name);
}
