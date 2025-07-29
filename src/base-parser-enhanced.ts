// src/base-parser-enhanced.ts
import * as ts from 'typescript';
import { TypeFormatter } from './services/type-formatter';
import { z } from 'zod';
import { openPkgSchema } from './types/openpkg';
import { TypeResolverFactory } from './services/type-resolver-factory';
import { createCompilerAPIService, loadTsConfig } from './services/compiler-api';
import { TypeWalkerImpl } from './services/type-walker';
import { SymbolResolver } from './services/symbol-resolver';
import { TypeInferenceService } from './services/type-inference';
import { TypeCache } from './services/type-cache';
import { ErrorHandler } from './services/error-handler';
import { ModuleResolver } from './services/module-resolver';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

export interface EnhancedGeneratorOptions {
  includeResolvedTypes?: boolean;
  includeTypeHierarchy?: boolean;
  maxDepth?: number;
  useCompilerAPI?: boolean; // Feature flag for gradual rollout
  verbose?: boolean;
}

export function generateEnhancedSpec(
  entryFile: string, 
  options: EnhancedGeneratorOptions = {}
): z.infer<typeof openPkgSchema> {
  // Default options
  const {
    includeResolvedTypes = true,
    includeTypeHierarchy = true,
    maxDepth = 5,
    useCompilerAPI = true,
    verbose = false
  } = options;

  // Configure logger for verbose mode
  if (verbose) {
    logger.setVerbose(true);
  }

  // Initialize error handler
  const errorHandler = new ErrorHandler({ showWarnings: verbose });
  
  try {
    // Initialize TypeScript Compiler API
    const compilerService = createCompilerAPIService();
    const tsConfig = loadTsConfig(path.dirname(entryFile));
    const program = compilerService.createProgram([entryFile], tsConfig || undefined);
    const typeChecker = compilerService.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);

    if (!sourceFile) {
      throw new Error(`Could not load source file: ${entryFile}`);
    }

    // Initialize all services
    const typeCache = new TypeCache();
    const symbolResolver = new SymbolResolver(typeChecker);
    const typeInference = new TypeInferenceService(typeChecker);
    const moduleResolver = new ModuleResolver(typeChecker, program);
    
    // Warm up cache with common types
    typeCache.warmUp([sourceFile], typeChecker);

    // Get type resolver (uses Compiler API)
    const typeResolver = TypeResolverFactory.getCompilerResolver([entryFile]);
    const typeWalker = new TypeWalkerImpl(typeChecker);

    // Collections for output
    const exports: z.infer<typeof openPkgSchema>['exports'] = [];
    const types: z.infer<typeof openPkgSchema>['types'] = [];
    const typeNames = new Set<string>();

    // Get the source file symbol to access exports
    const sourceFileSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (sourceFileSymbol) {
      const exportedSymbols = typeChecker.getExportsOfModule(sourceFileSymbol);
      
      for (const symbol of exportedSymbols) {
        const name = symbol.getName();
        const declarations = symbol.getDeclarations();
        
        if (!declarations || declarations.length === 0) continue;
        
        const declaration = declarations[0];
        
        if (ts.isFunctionDeclaration(declaration)) {
          const functionExport = processFunctionDeclaration(
            declaration,
            symbol,
            {
              typeChecker,
              symbolResolver,
              typeResolver,
              typeInference,
              typeCache,
              sourceFile,
              entryFile,
              includeResolvedTypes
            }
          );
          exports.push(functionExport);
          
        } else if (ts.isInterfaceDeclaration(declaration)) {
          const interfaceInfo = processInterfaceDeclaration(
            declaration,
            symbol,
            {
              typeChecker,
              symbolResolver,
              typeResolver,
              typeWalker,
              typeCache,
              sourceFile,
              entryFile,
              includeResolvedTypes,
              includeTypeHierarchy,
              maxDepth
            }
          );
          types.push(interfaceInfo);
          typeNames.add(name);
          
        } else if (ts.isTypeAliasDeclaration(declaration)) {
          const typeAliasInfo = processTypeAliasDeclaration(
            declaration,
            symbol,
            {
              typeChecker,
              symbolResolver,
              typeResolver,
              typeWalker,
              typeCache,
              sourceFile,
              entryFile,
              includeResolvedTypes,
              maxDepth
            }
          );
          types.push(typeAliasInfo);
          typeNames.add(name);
          
        } else if (ts.isClassDeclaration(declaration)) {
          const classInfo = processClassDeclaration(
            declaration,
            symbol,
            {
              typeChecker,
              symbolResolver,
              typeResolver,
              typeWalker,
              typeCache,
              sourceFile,
              entryFile,
              includeResolvedTypes,
              includeTypeHierarchy,
              maxDepth
            }
          );
          exports.push(classInfo.export);
          types.push(classInfo.type);
          typeNames.add(name);
          
        } else if (ts.isEnumDeclaration(declaration)) {
          const enumInfo = processEnumDeclaration(
            declaration,
            symbol,
            {
              typeChecker,
              symbolResolver,
              typeWalker,
              sourceFile,
              entryFile
            }
          );
          exports.push(enumInfo.export);
          types.push(enumInfo.type);
          typeNames.add(name);
        }
      }
    }

    // Get package metadata
    const pkgPath = path.resolve(path.dirname(entryFile), 'package.json');
    let pkg = { name: 'unknown', version: '1.0.0', description: '', license: '', repository: { url: '' } };
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
    
    const spec = {
      openpkg: '1.0.0' as const,
      meta: { 
        name: pkg.name,
        version: pkg.version,
        ecosystem: 'js/ts' as const,
        description: pkg.description,
        license: pkg.license,
        repository: pkg.repository?.url
      },
      exports,
      types
    };

    // Clear caches
    typeWalker.clearVisited();

    // Print cache statistics if verbose
    const cacheStats = typeCache.getStats();
    if (verbose) {
      logger.debug('Cache statistics:', {
        hitRate: `${(cacheStats.hitRate * 100).toFixed(2)}%`,
        totalEntries: cacheStats.totalEntries,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      });
    }

    return spec;
  } catch (error) {
    errorHandler.handleTypeResolutionError(error as Error, undefined, 'generateEnhancedSpec');
    errorHandler.printAll();
    throw error;
  }
}

// Helper functions for processing different declaration types

function processFunctionDeclaration(
  declaration: ts.FunctionDeclaration,
  symbol: ts.Symbol,
  context: any
): any {
  const { typeChecker, symbolResolver, typeResolver, typeInference, typeCache, sourceFile, entryFile, includeResolvedTypes } = context;
  
  const signature = typeChecker.getSignatureFromDeclaration(declaration);
  if (!signature) return null;
  
  // Get JSDoc information
  const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
  
  // Process parameters with full type resolution
  const parameters = signature.getParameters().map(param => {
    const paramType = typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
    const resolvedType = typeCache.getOrResolveType(
      param.valueDeclaration as ts.Node,
      () => typeResolver.resolveType(param.valueDeclaration as ts.Node)
    );
    
    // Get parameter description from JSDoc
    const paramDescription = jsDocInfo?.params.get(param.getName()) || 
                           ts.displayPartsToString(param.getDocumentationComment(typeChecker));
    
    const paramInfo: any = {
      name: param.getName(),
      type: TypeFormatter.createRef(typeChecker.typeToString(paramType)),
      optional: !!(param.flags & ts.SymbolFlags.Optional),
      description: paramDescription
    };

    // Add resolved type information if requested
    if (includeResolvedTypes && resolvedType) {
      paramInfo.resolvedType = resolvedType;
    }

    return paramInfo;
  });

  // Process return type
  const returnType = signature.getReturnType();
  const isInferredReturn = typeInference.isInferredReturnType(declaration);
  
  // Build the export entry
  const functionExport: any = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'function',
    signatures: [{
      parameters,
      returnType: TypeFormatter.createRef(typeChecker.typeToString(returnType))
    }],
    description: jsDocInfo?.description || ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
    examples: jsDocInfo?.examples || [],
    source: { 
      file: entryFile, 
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1 
    },
    flags: {
      isInferredReturn
    },
    tags: jsDocInfo?.tags || []
  };

  // Add JSDoc metadata if available
  if (jsDocInfo) {
    if (jsDocInfo.since) functionExport.since = jsDocInfo.since;
    if (jsDocInfo.deprecated) functionExport.deprecated = true;
    if (jsDocInfo.see && jsDocInfo.see.length > 0) functionExport.see = jsDocInfo.see;
  }

  return functionExport;
}

function processInterfaceDeclaration(
  declaration: ts.InterfaceDeclaration,
  symbol: ts.Symbol,
  context: any
): any {
  const { typeChecker, symbolResolver, typeResolver, typeWalker, typeCache, sourceFile, entryFile, includeResolvedTypes, includeTypeHierarchy, maxDepth } = context;
  
  const type = typeChecker.getTypeAtLocation(declaration);
  const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
  
  // Get all properties including inherited ones
  const properties = typeResolver.getProperties(type).map(prop => {
    const propInfo: any = {
      name: prop.name,
      type: prop.type.typeString,
      optional: prop.optional,
      readonly: prop.readonly,
      description: prop.description
    };

    if (includeResolvedTypes && prop.type) {
      propInfo.resolvedType = prop.type;
    }

    return propInfo;
  });

  const interfaceInfo: any = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'interface',
    properties,
    description: jsDocInfo?.description || ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
    source: {
      file: entryFile,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
    }
  };

  // Add type hierarchy if requested
  if (includeTypeHierarchy) {
    const typeStructure = typeWalker.walk(type, 0, maxDepth);
    interfaceInfo.typeHierarchy = typeStructure;
  }

  // Add extended interfaces
  if (declaration.heritageClauses) {
    interfaceInfo.extends = declaration.heritageClauses
      .filter(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
      .flatMap(clause => clause.types.map(t => t.getText()));
  }

  return interfaceInfo;
}

function processTypeAliasDeclaration(
  declaration: ts.TypeAliasDeclaration,
  symbol: ts.Symbol,
  context: any
): any {
  const { typeChecker, symbolResolver, typeResolver, typeWalker, typeCache, sourceFile, entryFile, includeResolvedTypes, maxDepth } = context;
  
  const type = typeChecker.getTypeAtLocation(declaration);
  const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
  
  // Expand the type alias
  const expandedType = typeResolver.expandGeneric(type);
  
  const typeAliasInfo: any = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'type',
    type: typeChecker.typeToString(type),
    description: jsDocInfo?.description || ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
    source: {
      file: entryFile,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
    }
  };

  // Add expanded type information
  if (includeResolvedTypes && expandedType) {
    typeAliasInfo.expandedType = expandedType;
    
    // If it's a utility type, show the resolved properties
    if (expandedType.properties && expandedType.properties.length > 0) {
      typeAliasInfo.resolvedProperties = expandedType.properties;
    }
  }

  // Add type parameters if generic
  if (declaration.typeParameters) {
    typeAliasInfo.typeParameters = declaration.typeParameters.map(tp => ({
      name: tp.name.text,
      constraint: tp.constraint ? tp.constraint.getText() : undefined
    }));
  }

  return typeAliasInfo;
}

function processClassDeclaration(
  declaration: ts.ClassDeclaration,
  symbol: ts.Symbol,
  context: any
): any {
  const { typeChecker, symbolResolver, typeResolver, typeWalker, typeCache, sourceFile, entryFile, includeResolvedTypes, includeTypeHierarchy, maxDepth } = context;
  
  const classType = typeChecker.getTypeAtLocation(declaration);
  const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
  
  // Process class members
  const members = classType.getProperties().map(prop => {
    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
    return {
      name: prop.getName(),
      type: typeChecker.typeToString(propType),
      visibility: getVisibility(prop),
      static: !!(prop.flags & ts.SymbolFlags.Static),
      optional: !!(prop.flags & ts.SymbolFlags.Optional),
      description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker))
    };
  });

  // Get constructor information
  const constructors = classType.getConstructSignatures().map(sig => ({
    parameters: sig.getParameters().map(param => ({
      name: param.getName(),
      type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!)),
      optional: !!(param.flags & ts.SymbolFlags.Optional)
    }))
  }));

  const baseInfo = {
    id: symbol.getName(),
    name: symbol.getName(),
    description: jsDocInfo?.description || ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
    source: {
      file: entryFile,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
    }
  };

  return {
    export: {
      ...baseInfo,
      kind: 'class',
      constructors,
      examples: jsDocInfo?.examples || [],
      flags: {},
      tags: jsDocInfo?.tags || []
    },
    type: {
      ...baseInfo,
      kind: 'class',
      members,
      extends: declaration.heritageClauses
        ?.filter(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
        .flatMap(clause => clause.types.map(t => t.getText()))
    }
  };
}

function processEnumDeclaration(
  declaration: ts.EnumDeclaration,
  symbol: ts.Symbol,
  context: any
): any {
  const { typeChecker, symbolResolver, typeWalker, sourceFile, entryFile } = context;
  
  const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
  
  const enumMembers = declaration.members.map(member => {
    const memberSymbol = typeChecker.getSymbolAtLocation(member.name);
    const memberType = typeChecker.getTypeAtLocation(member);
    
    return {
      name: member.name.getText(),
      value: member.initializer ? typeChecker.getConstantValue(member as ts.EnumMember) : undefined,
      description: ts.displayPartsToString(memberSymbol?.getDocumentationComment(typeChecker) || [])
    };
  });

  const baseInfo = {
    id: symbol.getName(),
    name: symbol.getName(),
    description: jsDocInfo?.description || ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
    source: {
      file: entryFile,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
    }
  };

  return {
    export: {
      ...baseInfo,
      kind: 'enum',
      examples: jsDocInfo?.examples || [],
      flags: {},
      tags: jsDocInfo?.tags || []
    },
    type: {
      ...baseInfo,
      kind: 'enum',
      members: enumMembers
    }
  };
}

function getVisibility(symbol: ts.Symbol): string {
  const flags = ts.getCombinedModifierFlags(symbol.valueDeclaration as ts.Declaration);
  if (flags & ts.ModifierFlags.Private) return 'private';
  if (flags & ts.ModifierFlags.Protected) return 'protected';
  return 'public';
}

// Export the original function name for backward compatibility
export const generateBaseSpec = generateEnhancedSpec;