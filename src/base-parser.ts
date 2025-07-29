// src/base-parser.ts
import * as ts from 'typescript';
import { Project, SourceFile, Node } from 'ts-morph';
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
import fs from 'fs';
import path from 'path';

export function generateBaseSpec(entryFile: string): z.infer<typeof openPkgSchema> {
  // Initialize error handler
  const errorHandler = new ErrorHandler({ showWarnings: true });
  
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

    // Initialize Phase 3 services
    const typeCache = new TypeCache();
    const symbolResolver = new SymbolResolver(typeChecker);
    const typeInference = new TypeInferenceService(typeChecker);
    
    // Warm up cache with common types
    typeCache.warmUp([sourceFile], typeChecker);

    // Also create ts-morph project for basic operations
    const project = new Project({ compilerOptions: tsConfig || {} });
    const morphSourceFile = project.addSourceFileAtPath(entryFile);

    // Get type resolver (uses Compiler API)
    const typeResolver = TypeResolverFactory.getCompilerResolver([entryFile]);
    const typeWalker = new TypeWalkerImpl(typeChecker);

  // Basic extraction: Find exports, signatures, create $refs for types
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
        const signature = typeChecker.getSignatureFromDeclaration(declaration);
        if (signature) {
          // Get JSDoc information using symbol resolver
          const jsDocInfo = symbolResolver.getJSDocFromNode(declaration);
          
          const parameters = signature.getParameters().map(param => {
            const paramType = typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
            const resolvedType = typeCache.getOrResolveType(
              param.valueDeclaration as ts.Node,
              () => typeResolver.resolveType(param.valueDeclaration as ts.Node)
            );
            
            // Get parameter description from JSDoc
            const paramDescription = jsDocInfo?.params.get(param.getName()) || 
                                   ts.displayPartsToString(param.getDocumentationComment(typeChecker));
            
            return {
              name: param.getName(),
              type: TypeFormatter.createRef(typeResolver.getTypeString(paramType)),
              optional: !!(param.flags & ts.SymbolFlags.Optional),
              description: paramDescription
            };
          });

          // Check if return type is inferred
          const returnType = signature.getReturnType();
          const isInferredReturn = typeInference.isInferredReturnType(declaration);
          const jsDocTags = ts.getJSDocTags(declaration);
          
          exports.push({
            id: name,
            name,
            kind: 'function',
            signatures: [{
              parameters,
              returnType: TypeFormatter.createRef(typeChecker.typeToString(returnType))
            }],
            description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
            examples: [],
            source: { 
              file: entryFile, 
              line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1 
            },
            flags: {},
            tags: jsDocTags.map(tag => ({
              name: tag.tagName.text,
              text: tag.comment || ''
            }))
          });
        }
      } else if (ts.isInterfaceDeclaration(declaration)) {
        // Use type walker for deep type resolution
        const type = typeChecker.getTypeAtLocation(declaration);
        const typeStructure = typeWalker.walk(type, 0);
        
        types.push({
          id: name,
          name,
          kind: 'interface',
          properties: declaration.members
            .filter(ts.isPropertySignature)
            .map(prop => {
              const propSymbol = typeChecker.getSymbolAtLocation(prop.name!);
              const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol!, prop);
              const expandedType = typeResolver.expandGeneric(propType);
              
              return {
                name: prop.name!.getText(),
                type: typeChecker.typeToString(propType),
                optional: !!prop.questionToken,
                description: ts.displayPartsToString(propSymbol?.getDocumentationComment(typeChecker) || [])
              };
            }),
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          }
        });
        typeNames.add(name);
      } else if (ts.isTypeAliasDeclaration(declaration)) {
        const type = typeChecker.getTypeAtLocation(declaration);
        const expandedType = typeResolver.expandGeneric(type);
        
        types.push({
          id: name,
          name,
          kind: 'type',
          type: typeChecker.typeToString(type),
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          }
        });
        typeNames.add(name);
      } else if (ts.isClassDeclaration(declaration)) {
        // Handle class exports
        const classType = typeChecker.getTypeAtLocation(declaration);
        const typeStructure = typeWalker.walk(classType, 0);
        
        // Add class to exports
        exports.push({
          id: name,
          name,
          kind: 'class',
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          examples: [],
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          },
          flags: {},
          tags: []
        });
        
        // Also add to types for reference
        types.push({
          id: name,
          name,
          kind: 'class',
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          }
        });
        typeNames.add(name);
      } else if (ts.isEnumDeclaration(declaration)) {
        // Handle enum exports
        const enumType = typeChecker.getTypeAtLocation(declaration);
        const typeStructure = typeWalker.walk(enumType, 0);
        
        const enumMembers = declaration.members.map(member => {
          const memberSymbol = typeChecker.getSymbolAtLocation(member.name);
          const memberType = typeChecker.getTypeAtLocation(member);
          
          return {
            name: member.name.getText(),
            value: member.initializer ? typeChecker.getConstantValue(member as ts.EnumMember) : undefined,
            description: ts.displayPartsToString(memberSymbol?.getDocumentationComment(typeChecker) || [])
          };
        });
        
        exports.push({
          id: name,
          name,
          kind: 'enum',
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          examples: [],
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          },
          flags: {},
          tags: []
        });
        
        types.push({
          id: name,
          name,
          kind: 'enum',
          members: enumMembers,
          description: ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)),
          source: {
            file: entryFile,
            line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1
          }
        });
        typeNames.add(name);
      }
    }
  }

  // For meta: Improve inference
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

    // Clear type walker cache
    typeWalker.clearVisited();

    // Print cache statistics if verbose
    const cacheStats = typeCache.getStats();
    if (process.env.VERBOSE) {
      console.log('Cache statistics:', cacheStats);
    }

    return spec;
  } catch (error) {
    errorHandler.handleTypeResolutionError(error as Error, undefined, 'generateBaseSpec');
    errorHandler.printAll();
    throw error;
  }
}