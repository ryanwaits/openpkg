import * as ts from 'typescript';
import * as path from 'path';

/**
 * Service for resolving module imports and cross-file type references
 */
export class ModuleResolver {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;
  private resolvedModules = new Map<string, ts.SourceFile>();

  constructor(program: ts.Program) {
    this.program = program;
    this.typeChecker = program.getTypeChecker();
  }

  /**
   * Resolve an import declaration to its source file
   */
  resolveImport(importDecl: ts.ImportDeclaration, currentFile: ts.SourceFile): ts.SourceFile | undefined {
    const moduleSpecifier = importDecl.moduleSpecifier;
    
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return undefined;
    }

    const moduleName = moduleSpecifier.text;
    return this.resolveModule(moduleName, currentFile.fileName);
  }

  /**
   * Resolve a module by name from a given file
   */
  resolveModule(moduleName: string, containingFile: string): ts.SourceFile | undefined {
    // Check cache first
    const cacheKey = `${containingFile}:${moduleName}`;
    if (this.resolvedModules.has(cacheKey)) {
      return this.resolvedModules.get(cacheKey);
    }

    // Use TypeScript's module resolution
    const resolvedModule = ts.resolveModuleName(
      moduleName,
      containingFile,
      this.program.getCompilerOptions(),
      ts.sys
    );

    if (resolvedModule.resolvedModule) {
      const resolvedFileName = resolvedModule.resolvedModule.resolvedFileName;
      const sourceFile = this.program.getSourceFile(resolvedFileName);
      
      if (sourceFile) {
        this.resolvedModules.set(cacheKey, sourceFile);
        return sourceFile;
      }
    }

    return undefined;
  }

  /**
   * Get all exported symbols from a module
   */
  getModuleExports(sourceFile: ts.SourceFile): Map<string, ts.Symbol> {
    const exports = new Map<string, ts.Symbol>();
    const sourceFileSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);

    if (sourceFileSymbol) {
      const moduleExports = this.typeChecker.getExportsOfModule(sourceFileSymbol);
      
      for (const exportSymbol of moduleExports) {
        exports.set(exportSymbol.getName(), exportSymbol);
      }
    }

    return exports;
  }

  /**
   * Resolve a specific named import
   */
  resolveNamedImport(importName: string, importDecl: ts.ImportDeclaration, currentFile: ts.SourceFile): ts.Symbol | undefined {
    const moduleFile = this.resolveImport(importDecl, currentFile);
    if (!moduleFile) return undefined;

    const exports = this.getModuleExports(moduleFile);
    return exports.get(importName);
  }

  /**
   * Get all imports in a source file
   */
  getFileImports(sourceFile: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const importInfo = this.parseImportDeclaration(node, sourceFile);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return imports;
  }

  /**
   * Parse import declaration into structured format
   */
  private parseImportDeclaration(importDecl: ts.ImportDeclaration, sourceFile: ts.SourceFile): ImportInfo | undefined {
    if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
      return undefined;
    }

    const moduleName = importDecl.moduleSpecifier.text;
    const importClause = importDecl.importClause;
    
    if (!importClause) {
      // Side-effect import
      return {
        moduleName,
        type: 'side-effect',
        imports: []
      };
    }

    const imports: ImportedSymbol[] = [];

    // Default import
    if (importClause.name) {
      imports.push({
        name: importClause.name.text,
        alias: importClause.name.text,
        isDefault: true
      });
    }

    // Named imports
    if (importClause.namedBindings) {
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        // import * as ns from 'module'
        imports.push({
          name: '*',
          alias: importClause.namedBindings.name.text,
          isDefault: false
        });
      } else if (ts.isNamedImports(importClause.namedBindings)) {
        // import { a, b as c } from 'module'
        for (const element of importClause.namedBindings.elements) {
          imports.push({
            name: element.propertyName?.text || element.name.text,
            alias: element.name.text,
            isDefault: false
          });
        }
      }
    }

    return {
      moduleName,
      type: 'normal',
      imports,
      resolvedPath: this.resolveModule(moduleName, sourceFile.fileName)?.fileName
    };
  }

  /**
   * Resolve re-exported types
   */
  resolveReExports(sourceFile: ts.SourceFile): Map<string, ReExportInfo> {
    const reExports = new Map<string, ReExportInfo>();

    const visitNode = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        // export { ... } from 'module'
        const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
        const fromModule = moduleSpecifier.text;
        const resolvedModule = this.resolveModule(fromModule, sourceFile.fileName);

        if (resolvedModule && node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const originalName = element.propertyName?.text || element.name.text;
            const exportedName = element.name.text;

            reExports.set(exportedName, {
              originalName,
              fromModule,
              resolvedModule: resolvedModule.fileName
            });
          }
        }
      }
      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return reExports;
  }

  /**
   * Get type from imported symbol
   */
  getImportedType(importedSymbol: ImportedSymbol, importInfo: ImportInfo): ts.Type | undefined {
    if (!importInfo.resolvedPath) return undefined;

    const sourceFile = this.program.getSourceFile(importInfo.resolvedPath);
    if (!sourceFile) return undefined;

    const exports = this.getModuleExports(sourceFile);
    const symbol = exports.get(importedSymbol.name);

    if (symbol) {
      return this.typeChecker.getTypeOfSymbolAtLocation(symbol, sourceFile);
    }

    return undefined;
  }

  /**
   * Resolve path aliases from tsconfig
   */
  resolvePathAlias(moduleName: string): string {
    const compilerOptions = this.program.getCompilerOptions();
    const paths = compilerOptions.paths;

    if (!paths) return moduleName;

    for (const [alias, replacements] of Object.entries(paths)) {
      const pattern = alias.replace('*', '(.*)');
      const regex = new RegExp(`^${pattern}$`);
      const match = moduleName.match(regex);

      if (match && replacements.length > 0) {
        const replacement = replacements[0];
        if (match[1]) {
          return replacement.replace('*', match[1]);
        }
        return replacement;
      }
    }

    return moduleName;
  }

  /**
   * Check if a module is external (node_modules)
   */
  isExternalModule(moduleName: string): boolean {
    return !moduleName.startsWith('.') && !moduleName.startsWith('/');
  }

  /**
   * Get all files that import a specific file
   */
  getImportingFiles(targetFile: string): string[] {
    const importingFiles: string[] = [];
    const normalizedTarget = path.normalize(targetFile);

    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      const imports = this.getFileImports(sourceFile);
      
      for (const importInfo of imports) {
        if (importInfo.resolvedPath && 
            path.normalize(importInfo.resolvedPath) === normalizedTarget) {
          importingFiles.push(sourceFile.fileName);
          break;
        }
      }
    }

    return importingFiles;
  }
}

export interface ImportInfo {
  moduleName: string;
  type: 'normal' | 'side-effect';
  imports: ImportedSymbol[];
  resolvedPath?: string;
}

export interface ImportedSymbol {
  name: string;
  alias: string;
  isDefault: boolean;
}

export interface ReExportInfo {
  originalName: string;
  fromModule: string;
  resolvedModule: string;
}