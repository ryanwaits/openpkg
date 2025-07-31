import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { collectReferencedTypes } from './utils/type-utils';
import { parseJSDocComment, getParameterDocumentation } from './utils/tsdoc-utils';
import { structureParameter } from './utils/parameter-utils';
export async function extractPackageSpec(entryFile, packageDir) {
    // Use package directory or derive from entry file
    const baseDir = packageDir || path.dirname(entryFile);
    // Load project's tsconfig if available
    const configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'tsconfig.json');
    let compilerOptions = {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        lib: ["lib.es2021.d.ts"],
        allowJs: true,
        declaration: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
    };
    if (configPath) {
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }
    // Create program with proper config
    const program = ts.createProgram([entryFile], compilerOptions);
    const typeChecker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);
    if (!sourceFile) {
        throw new Error(`Could not load ${entryFile}`);
    }
    // Get package.json info from package directory
    const packageJsonPath = path.join(baseDir, 'package.json');
    const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};
    const spec = {
        openpkg: "1.0.0",
        meta: {
            name: packageJson.name || "unknown",
            version: packageJson.version || "1.0.0",
            description: packageJson.description || "",
            license: packageJson.license || "",
            repository: packageJson.repository?.url || packageJson.repository || "",
            ecosystem: "js/ts"
        },
        exports: [],
        types: []
    };
    // Track types we've seen
    const typeRefs = new Map(); // typeName -> typeId
    const typeDefinitions = new Map(); // typeName -> type definition (to avoid duplicates)
    const referencedTypes = new Set(); // Track all types that are referenced
    let typeCounter = 0;
    // Get exports
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol) {
        const exports = typeChecker.getExportsOfModule(moduleSymbol);
        // First pass: collect all exported type names
        for (const symbol of exports) {
            const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
            if (!declaration)
                continue;
            const name = symbol.getName();
            if (ts.isClassDeclaration(declaration) ||
                ts.isInterfaceDeclaration(declaration) ||
                ts.isTypeAliasDeclaration(declaration) ||
                ts.isEnumDeclaration(declaration)) {
                typeRefs.set(name, name);
            }
        }
        // Second pass: process exports with type refs available
        for (const symbol of exports) {
            const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
            if (!declaration)
                continue;
            const name = symbol.getName();
            const id = name;
            // Extract based on kind
            if (ts.isFunctionDeclaration(declaration)) {
                spec.exports.push({
                    id,
                    name,
                    kind: "function",
                    signatures: getFunctionSignatures(declaration, typeChecker, typeRefs, referencedTypes),
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
            }
            else if (ts.isClassDeclaration(declaration)) {
                spec.exports.push({
                    id,
                    name,
                    kind: "class",
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
                // Add to types (avoid duplicates)
                if (!typeDefinitions.has(name)) {
                    const typeDef = {
                        id,
                        name,
                        kind: "class",
                        description: getJSDocComment(symbol, typeChecker),
                        source: getSourceLocation(declaration)
                    };
                    typeDefinitions.set(name, typeDef);
                    spec.types?.push(typeDef);
                    typeRefs.set(name, id);
                }
            }
            else if (ts.isInterfaceDeclaration(declaration)) {
                spec.exports.push({
                    id,
                    name,
                    kind: "interface",
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
                // Add to types with properties (avoid duplicates)
                if (!typeDefinitions.has(name)) {
                    const typeDef = {
                        id,
                        name,
                        kind: "interface",
                        properties: getInterfaceProperties(declaration, typeChecker, typeRefs, referencedTypes),
                        description: getJSDocComment(symbol, typeChecker),
                        source: getSourceLocation(declaration)
                    };
                    typeDefinitions.set(name, typeDef);
                    spec.types?.push(typeDef);
                    typeRefs.set(name, id);
                }
            }
            else if (ts.isTypeAliasDeclaration(declaration)) {
                spec.exports.push({
                    id,
                    name,
                    kind: "type",
                    type: typeToRef(declaration.type, typeChecker, typeRefs),
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
                // Add to types (avoid duplicates)
                if (!typeDefinitions.has(name)) {
                    const typeDef = {
                        id,
                        name,
                        kind: "type",
                        type: typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration)),
                        description: getJSDocComment(symbol, typeChecker),
                        source: getSourceLocation(declaration)
                    };
                    typeDefinitions.set(name, typeDef);
                    spec.types?.push(typeDef);
                    typeRefs.set(name, id);
                }
            }
            else if (ts.isEnumDeclaration(declaration)) {
                spec.exports.push({
                    id,
                    name,
                    kind: "enum",
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
                // Add to types with members (avoid duplicates)
                if (!typeDefinitions.has(name)) {
                    const typeDef = {
                        id,
                        name,
                        kind: "enum",
                        members: getEnumMembers(declaration),
                        description: getJSDocComment(symbol, typeChecker),
                        source: getSourceLocation(declaration)
                    };
                    typeDefinitions.set(name, typeDef);
                    spec.types?.push(typeDef);
                    typeRefs.set(name, id);
                }
            }
            else if (ts.isVariableDeclaration(declaration)) {
                const type = typeChecker.getTypeAtLocation(declaration);
                spec.exports.push({
                    id,
                    name,
                    kind: "variable",
                    type: typeToRef(declaration, typeChecker, typeRefs),
                    description: getJSDocComment(symbol, typeChecker),
                    source: getSourceLocation(declaration)
                });
            }
        }
        // Third pass: Add referenced types that weren't directly exported
        for (const typeName of referencedTypes) {
            if (!typeRefs.has(typeName) && !typeDefinitions.has(typeName)) {
                // Try to find this type in the program
                const allSourceFiles = program.getSourceFiles();
                for (const file of allSourceFiles) {
                    // Skip node_modules and declaration files from other packages
                    if (file.fileName.includes('node_modules') ||
                        (file.fileName.endsWith('.d.ts') && !file.fileName.startsWith(baseDir))) {
                        continue;
                    }
                    const fileSymbol = typeChecker.getSymbolAtLocation(file);
                    if (fileSymbol) {
                        const exports = typeChecker.getExportsOfModule(fileSymbol);
                        for (const exportSymbol of exports) {
                            if (exportSymbol.getName() === typeName && !typeDefinitions.has(typeName)) {
                                const declaration = exportSymbol.valueDeclaration || exportSymbol.declarations?.[0];
                                if (!declaration)
                                    continue;
                                if (ts.isInterfaceDeclaration(declaration)) {
                                    const typeDef = {
                                        id: typeName,
                                        name: typeName,
                                        kind: "interface",
                                        properties: getInterfaceProperties(declaration, typeChecker, typeRefs, referencedTypes),
                                        description: getJSDocComment(exportSymbol, typeChecker),
                                        source: getSourceLocation(declaration)
                                    };
                                    typeDefinitions.set(typeName, typeDef);
                                    spec.types?.push(typeDef);
                                    typeRefs.set(typeName, typeName);
                                }
                                else if (ts.isTypeAliasDeclaration(declaration)) {
                                    const typeDef = {
                                        id: typeName,
                                        name: typeName,
                                        kind: "type",
                                        type: typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration)),
                                        description: getJSDocComment(exportSymbol, typeChecker),
                                        source: getSourceLocation(declaration)
                                    };
                                    typeDefinitions.set(typeName, typeDef);
                                    spec.types?.push(typeDef);
                                    typeRefs.set(typeName, typeName);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return spec;
}
// Helper functions
function getJSDocComment(symbol, typeChecker) {
    const comments = symbol.getDocumentationComment(typeChecker);
    return ts.displayPartsToString(comments);
}
function getSourceLocation(node) {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {
        file: sourceFile.fileName,
        line: line + 1
    };
}
function typeToRef(node, typeChecker, typeRefs, referencedTypes) {
    const type = typeChecker.getTypeAtLocation(node);
    const typeString = typeChecker.typeToString(type);
    // Check if this is a primitive type
    if (['string', 'number', 'boolean', 'any', 'unknown', 'void', 'undefined', 'null', 'never'].includes(typeString)) {
        return typeString;
    }
    // Collect referenced types if provided
    if (referencedTypes) {
        collectReferencedTypes(type, typeChecker, referencedTypes);
    }
    // Check if this is a known type by analyzing the type string
    // This handles cases where the symbol might not be directly available
    for (const [typeName, typeId] of typeRefs.entries()) {
        if (typeString === typeName || typeString.startsWith(typeName + '<')) {
            return { $ref: `#/types/${typeId}` };
        }
    }
    // Check if this is a known type via symbol
    const symbol = type.getSymbol();
    if (symbol) {
        const symbolName = symbol.getName();
        if (typeRefs.has(symbolName)) {
            return { $ref: `#/types/${symbolName}` };
        }
        // Add to referenced types for later processing
        if (referencedTypes && !isBuiltInType(symbolName)) {
            referencedTypes.add(symbolName);
            return { $ref: `#/types/${symbolName}` };
        }
    }
    // Otherwise return as string (for complex types, arrays, unions, etc.)
    return typeString;
}
function isBuiltInType(name) {
    const builtIns = [
        'string', 'number', 'boolean', 'any', 'unknown', 'void',
        'undefined', 'null', 'never', 'object', 'Promise', 'Array',
        'Map', 'Set', 'Date', 'RegExp', 'Error', 'Function',
        'Uint8Array', 'ArrayBufferLike', 'ArrayBuffer', 'Uint8ArrayConstructor',
        '__type' // Anonymous types
    ];
    return builtIns.includes(name);
}
function getFunctionSignatures(func, typeChecker, typeRefs, referencedTypes) {
    const signature = typeChecker.getSignatureFromDeclaration(func);
    if (!signature)
        return [];
    // Get function documentation
    const funcSymbol = typeChecker.getSymbolAtLocation(func.name || func);
    const functionDoc = funcSymbol ? parseJSDocComment(funcSymbol, typeChecker) : null;
    return [{
            parameters: signature.getParameters().map(param => {
                const paramDecl = param.valueDeclaration;
                const paramType = typeChecker.getTypeAtLocation(paramDecl);
                // Collect referenced types from parameter
                if (referencedTypes) {
                    collectReferencedTypes(paramType, typeChecker, referencedTypes);
                }
                // Get parameter documentation from TSDoc
                const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);
                // Use the new parameter structuring
                return structureParameter(param, paramDecl, paramType, typeChecker, typeRefs, functionDoc, paramDoc);
            }),
            returnType: signature.getReturnType() ? typeChecker.typeToString(signature.getReturnType()) : "void",
            description: functionDoc?.returns
        }];
}
function getInterfaceProperties(iface, typeChecker, typeRefs, referencedTypes) {
    return iface.members
        .filter(ts.isPropertySignature)
        .map(prop => {
        if (prop.type && referencedTypes) {
            const propType = typeChecker.getTypeAtLocation(prop.type);
            collectReferencedTypes(propType, typeChecker, referencedTypes);
        }
        return {
            name: prop.name?.getText() || "",
            type: prop.type ? typeToRef(prop.type, typeChecker, typeRefs, referencedTypes) : "any",
            optional: !!prop.questionToken,
            description: ""
        };
    });
}
function getEnumMembers(enumDecl) {
    return enumDecl.members.map(member => ({
        name: member.name?.getText() || "",
        value: member.initializer ? member.initializer.getText() : undefined,
        description: ""
    }));
}
