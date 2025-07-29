import * as ts from 'typescript';
import * as path from 'path';
import { z } from 'zod';
import { openPkgSchema } from './types/openpkg';

export function extractPackageSpec(entryFile: string): z.infer<typeof openPkgSchema> {
  // Create program
  const program = ts.createProgram([entryFile], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    lib: ["lib.es2021.d.ts"],
  });
  
  const typeChecker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryFile);
  
  if (!sourceFile) {
    throw new Error(`Could not load ${entryFile}`);
  }
  
  // Get package.json info
  const packageJsonPath = findPackageJson(entryFile);
  const packageJson = packageJsonPath ? require(packageJsonPath) : {};
  
  const spec: z.infer<typeof openPkgSchema> = {
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
  const typeRefs = new Map<string, string>(); // typeName -> typeId
  let typeCounter = 0;
  
  // Get exports
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol) {
    const exports = typeChecker.getExportsOfModule(moduleSymbol);
    
    // First pass: collect all type names
    for (const symbol of exports) {
      const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
      if (!declaration) continue;
      
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
      if (!declaration) continue;
      
      const name = symbol.getName();
      const id = name;
      
      // Extract based on kind
      if (ts.isFunctionDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: "function",
          signatures: getFunctionSignatures(declaration, typeChecker, typeRefs),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
      } else if (ts.isClassDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: "class",
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        
        // Add to types
        spec.types.push({
          id,
          name,
          kind: "class",
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        typeRefs.set(name, id);
      } else if (ts.isInterfaceDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: "interface",
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        
        // Add to types with properties
        spec.types.push({
          id,
          name,
          kind: "interface",
          properties: getInterfaceProperties(declaration, typeChecker, typeRefs),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        typeRefs.set(name, id);
      } else if (ts.isTypeAliasDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: "type",
          type: typeToRef(declaration.type, typeChecker, typeRefs),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        
        // Add to types
        spec.types.push({
          id,
          name,
          kind: "type",
          type: typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration)),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        typeRefs.set(name, id);
      } else if (ts.isEnumDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: "enum",
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        
        // Add to types with members
        spec.types.push({
          id,
          name,
          kind: "enum",
          members: getEnumMembers(declaration),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration)
        });
        typeRefs.set(name, id);
      } else if (ts.isVariableDeclaration(declaration)) {
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
  }
  
  return spec;
}

// Helper functions

function findPackageJson(startPath: string): string | null {
  let currentPath = path.dirname(path.resolve(startPath));
  
  while (currentPath !== path.dirname(currentPath)) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    if (require('fs').existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
    currentPath = path.dirname(currentPath);
  }
  
  return null;
}

function getJSDocComment(symbol: ts.Symbol, typeChecker: ts.TypeChecker): string {
  const comments = symbol.getDocumentationComment(typeChecker);
  return ts.displayPartsToString(comments);
}

function getSourceLocation(node: ts.Node): { file: string; line: number } {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return {
    file: sourceFile.fileName,
    line: line + 1
  };
}

function typeToRef(node: ts.Node, typeChecker: ts.TypeChecker, typeRefs: Map<string, string>): any {
  const type = typeChecker.getTypeAtLocation(node);
  const typeString = typeChecker.typeToString(type);
  
  // Check if this is a primitive type
  if (['string', 'number', 'boolean', 'any', 'unknown', 'void', 'undefined', 'null'].includes(typeString)) {
    return typeString;
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
  if (symbol && typeRefs.has(symbol.getName())) {
    return { $ref: `#/types/${typeRefs.get(symbol.getName())}` };
  }
  
  // Otherwise return as string (for complex types, arrays, unions, etc.)
  return typeString;
}

function getFunctionSignatures(
  func: ts.FunctionDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>
): any[] {
  const signature = typeChecker.getSignatureFromDeclaration(func);
  if (!signature) return [];
  
  return [{
    parameters: signature.getParameters().map(param => {
      const paramDecl = param.valueDeclaration as ts.ParameterDeclaration;
      return {
        name: param.getName(),
        type: typeToRef(paramDecl, typeChecker, typeRefs),
        optional: typeChecker.isOptionalParameter(paramDecl),
        description: getJSDocComment(param, typeChecker)
      };
    }),
    returnType: signature.getReturnType() ? typeChecker.typeToString(signature.getReturnType()) : "void"
  }];
}

function getInterfaceProperties(
  iface: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>
): any[] {
  return iface.members
    .filter(ts.isPropertySignature)
    .map(prop => ({
      name: prop.name?.getText() || "",
      type: prop.type ? typeToRef(prop.type, typeChecker, typeRefs) : "any",
      optional: !!prop.questionToken,
      description: ""
    }));
}

function getEnumMembers(enumDecl: ts.EnumDeclaration): any[] {
  return enumDecl.members.map(member => ({
    name: member.name?.getText() || "",
    value: member.initializer ? member.initializer.getText() : undefined,
    description: ""
  }));
}