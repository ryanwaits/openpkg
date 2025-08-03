import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { z } from 'zod';
import type { OpenPkgOptions } from './index';
import type { openPkgSchema } from './types/openpkg';

// Type aliases for better type safety
type TypeDefinition = z.infer<typeof openPkgSchema>['types'][number];
type SchemaDefinition = Record<string, unknown>;
type TypeReference = SchemaDefinition | string;

import { formatTypeReference, structureParameter } from './utils/parameter-utils';
import { getParameterDocumentation, parseJSDocComment } from './utils/tsdoc-utils';
import { collectReferencedTypes } from './utils/type-utils';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: OpenPkgOptions,
): Promise<z.infer<typeof openPkgSchema>> {
  // Use package directory or derive from entry file
  const baseDir = packageDir || path.dirname(entryFile);

  // Detect if node_modules exists
  const nodeModulesPath = path.join(baseDir, 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);

  // Determine if we should resolve external types
  const resolveExternalTypes = options?.resolveExternalTypes ?? hasNodeModules;

  // Log node_modules detection status
  if (hasNodeModules && resolveExternalTypes) {
    console.log('node_modules detected, resolving external types');
  }

  // Load project's tsconfig if available
  const configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'tsconfig.json');
  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    lib: ['lib.es2021.d.ts'],
    allowJs: true,
    declaration: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
  };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = { ...compilerOptions, ...parsedConfig.options };
  }

  // Create program with proper config
  let program: ts.Program;

  if (content !== undefined) {
    // Create in-memory source file
    const sourceFile = ts.createSourceFile(entryFile, content, ts.ScriptTarget.Latest, true);

    // Create a custom compiler host for in-memory compilation
    const compilerHost = ts.createCompilerHost(compilerOptions);
    const originalGetSourceFile = compilerHost.getSourceFile;

    compilerHost.getSourceFile = (
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) => {
      if (fileName === entryFile) {
        return sourceFile;
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };

    program = ts.createProgram([entryFile], compilerOptions, compilerHost);
  } else {
    program = ts.createProgram([entryFile], compilerOptions);
  }

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

  const spec: z.infer<typeof openPkgSchema> = {
    $schema:
      'https://raw.githubusercontent.com/ryanwaits/openpkg/main/schemas/v0.1.0/openpkg.schema.json',
    openpkg: '0.1.0',
    meta: {
      name: packageJson.name || 'unknown',
      version: packageJson.version || '1.0.0',
      description: packageJson.description || '',
      license: packageJson.license || '',
      repository: packageJson.repository?.url || packageJson.repository || '',
      ecosystem: 'js/ts',
    },
    exports: [],
    types: [],
  };

  // Track types we've seen
  const typeRefs = new Map<string, string>(); // typeName -> typeId
  const typeDefinitions = new Map<string, TypeDefinition>(); // typeName -> type definition (to avoid duplicates)
  const referencedTypes = new Set<string>(); // Track all types that are referenced
  const _typeCounter = 0;

  // Get exports
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol) {
    const exports = typeChecker.getExportsOfModule(moduleSymbol);

    // First pass: collect all exported type names
    for (const symbol of exports) {
      const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
      if (!declaration) continue;

      const name = symbol.getName();
      if (
        ts.isClassDeclaration(declaration) ||
        ts.isInterfaceDeclaration(declaration) ||
        ts.isTypeAliasDeclaration(declaration) ||
        ts.isEnumDeclaration(declaration)
      ) {
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
          kind: 'function',
          signatures: getFunctionSignatures(declaration, typeChecker, typeRefs, referencedTypes),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
        });
      } else if (ts.isClassDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: 'class',
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
        });

        // Add to types (avoid duplicates)
        if (!typeDefinitions.has(name)) {
          const typeDef = {
            id,
            name,
            kind: 'class' as const,
            description: getJSDocComment(symbol, typeChecker),
            source: getSourceLocation(declaration),
          };
          typeDefinitions.set(name, typeDef);
          spec.types?.push(typeDef);
          typeRefs.set(name, id);
        }
      } else if (ts.isInterfaceDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: 'interface',
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
        });

        // Add to types with properties (avoid duplicates)
        if (!typeDefinitions.has(name)) {
          const typeDef = {
            id,
            name,
            kind: 'interface' as const,
            schema: interfaceToSchema(declaration, typeChecker, typeRefs, referencedTypes),
            description: getJSDocComment(symbol, typeChecker),
            source: getSourceLocation(declaration),
          };
          typeDefinitions.set(name, typeDef);
          spec.types?.push(typeDef);
          typeRefs.set(name, id);
        }
      } else if (ts.isTypeAliasDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: 'type',
          type: typeToRef(declaration.type, typeChecker, typeRefs),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
        });

        // Add to types (avoid duplicates)
        if (!typeDefinitions.has(name)) {
          const typeDef = {
            id,
            name,
            kind: 'type' as const,
            type: typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration)),
            description: getJSDocComment(symbol, typeChecker),
            source: getSourceLocation(declaration),
          };
          typeDefinitions.set(name, typeDef);
          spec.types?.push(typeDef);
          typeRefs.set(name, id);
        }
      } else if (ts.isEnumDeclaration(declaration)) {
        spec.exports.push({
          id,
          name,
          kind: 'enum',
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
        });

        // Add to types with members (avoid duplicates)
        if (!typeDefinitions.has(name)) {
          const typeDef = {
            id,
            name,
            kind: 'enum' as const,
            members: getEnumMembers(declaration),
            description: getJSDocComment(symbol, typeChecker),
            source: getSourceLocation(declaration),
          };
          typeDefinitions.set(name, typeDef);
          spec.types?.push(typeDef);
          typeRefs.set(name, id);
        }
      } else if (ts.isVariableDeclaration(declaration)) {
        const _type = typeChecker.getTypeAtLocation(declaration);
        spec.exports.push({
          id,
          name,
          kind: 'variable',
          type: typeToRef(declaration, typeChecker, typeRefs),
          description: getJSDocComment(symbol, typeChecker),
          source: getSourceLocation(declaration),
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
          // unless we're resolving external types
          if (
            !resolveExternalTypes &&
            (file.fileName.includes('node_modules') ||
              (file.fileName.endsWith('.d.ts') && !file.fileName.startsWith(baseDir)))
          ) {
            continue;
          }

          const fileSymbol = typeChecker.getSymbolAtLocation(file);
          if (fileSymbol) {
            const exports = typeChecker.getExportsOfModule(fileSymbol);

            for (const exportSymbol of exports) {
              if (exportSymbol.getName() === typeName && !typeDefinitions.has(typeName)) {
                const declaration = exportSymbol.valueDeclaration || exportSymbol.declarations?.[0];
                if (!declaration) continue;

                if (ts.isInterfaceDeclaration(declaration)) {
                  const typeDef = {
                    id: typeName,
                    name: typeName,
                    kind: 'interface' as const,
                    schema: interfaceToSchema(declaration, typeChecker, typeRefs, referencedTypes),
                    description: getJSDocComment(exportSymbol, typeChecker),
                    source: getSourceLocation(declaration),
                  };
                  typeDefinitions.set(typeName, typeDef);
                  spec.types?.push(typeDef);
                  typeRefs.set(typeName, typeName);
                } else if (ts.isTypeAliasDeclaration(declaration)) {
                  const typeDef = {
                    id: typeName,
                    name: typeName,
                    kind: 'type' as const,
                    type: typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration)),
                    description: getJSDocComment(exportSymbol, typeChecker),
                    source: getSourceLocation(declaration),
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

function getJSDocComment(symbol: ts.Symbol, typeChecker: ts.TypeChecker): string {
  const comments = symbol.getDocumentationComment(typeChecker);
  return ts.displayPartsToString(comments);
}

function getSourceLocation(node: ts.Node): { file: string; line: number } {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}

function typeToRef(
  node: ts.Node,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
): TypeReference {
  const type = typeChecker.getTypeAtLocation(node);

  // Collect referenced types if provided
  if (referencedTypes) {
    collectReferencedTypes(type, typeChecker, referencedTypes);
  }

  // Use the consistent formatTypeReference function
  return formatTypeReference(type, typeChecker, typeRefs, referencedTypes);
}

function getFunctionSignatures(
  func: ts.FunctionDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
): Array<{
  parameters: ReturnType<typeof structureParameter>[];
  returns: { schema: TypeReference; description: string };
}> {
  const signature = typeChecker.getSignatureFromDeclaration(func);
  if (!signature) return [];

  // Get function documentation
  const funcSymbol = typeChecker.getSymbolAtLocation(func.name || func);
  const functionDoc = funcSymbol ? parseJSDocComment(funcSymbol, typeChecker) : null;

  return [
    {
      parameters: signature.getParameters().map((param) => {
        const paramDecl = param.valueDeclaration as ts.ParameterDeclaration;
        const paramType = typeChecker.getTypeAtLocation(paramDecl);

        // Collect referenced types from parameter
        if (referencedTypes) {
          collectReferencedTypes(paramType, typeChecker, referencedTypes);
        }

        // Get parameter documentation from TSDoc
        const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);

        // Use the new parameter structuring
        return structureParameter(
          param,
          paramDecl,
          paramType,
          typeChecker,
          typeRefs,
          functionDoc,
          paramDoc,
          referencedTypes,
        );
      }),
      returns: {
        schema: signature.getReturnType()
          ? formatTypeReference(signature.getReturnType(), typeChecker, typeRefs, referencedTypes)
          : { type: 'void' },
        description: functionDoc?.returns || '',
      },
    },
  ];
}

function interfaceToSchema(
  iface: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
): SchemaDefinition {
  const schema: SchemaDefinition = {
    type: 'object',
    properties: {},
  };

  const required: string[] = [];

  for (const prop of iface.members.filter(ts.isPropertySignature)) {
    const propName = prop.name?.getText() || '';

    if (prop.type && referencedTypes) {
      const propType = typeChecker.getTypeAtLocation(prop.type);
      collectReferencedTypes(propType, typeChecker, referencedTypes);
    }

    schema.properties[propName] = prop.type
      ? formatTypeReference(
          typeChecker.getTypeAtLocation(prop.type),
          typeChecker,
          typeRefs,
          referencedTypes,
        )
      : { type: 'any' };

    if (!prop.questionToken) {
      required.push(propName);
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function getEnumMembers(enumDecl: ts.EnumDeclaration): Array<{
  name: string;
  value?: string;
  description: string;
}> {
  return enumDecl.members.map((member) => ({
    name: member.name?.getText() || '',
    value: member.initializer ? member.initializer.getText() : undefined,
    description: '',
  }));
}
