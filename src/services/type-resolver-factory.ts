import * as ts from 'typescript';
import { Project } from 'ts-morph';
import { ITypeResolver } from './type-resolver';
import { CompilerAPITypeResolver } from './type-resolver-compiler';
import { TsMorphTypeResolver } from './type-resolver-tsmorph';
import { createCompilerAPIService, loadTsConfig } from './compiler-api';

export class TypeResolverFactory {
  private static compilerResolver: CompilerAPITypeResolver | null = null;
  private static tsMorphResolver: TsMorphTypeResolver | null = null;
  private static program: ts.Program | null = null;

  /**
   * Get a type resolver. By default uses TypeScript Compiler API for deep resolution,
   * but can fallback to ts-morph for specific operations
   */
  static getResolver(files: string[], useTsMorph = false): ITypeResolver {
    if (useTsMorph) {
      return this.getTsMorphResolver();
    }
    return this.getCompilerResolver(files);
  }

  /**
   * Get the TypeScript Compiler API resolver (preferred for deep type resolution)
   */
  static getCompilerResolver(files: string[]): CompilerAPITypeResolver {
    if (!this.compilerResolver || !this.program) {
      // Create compiler API service
      const compilerService = createCompilerAPIService();
      
      // Try to load tsconfig.json from the first file's directory
      const searchPath = files[0] ? files[0] : process.cwd();
      const tsConfig = loadTsConfig(searchPath);
      
      // Create program with files
      this.program = compilerService.createProgram(files, tsConfig || undefined);
      
      // Create resolver with type checker
      this.compilerResolver = new CompilerAPITypeResolver(compilerService.getTypeChecker());
    }
    
    return this.compilerResolver;
  }

  /**
   * Get the ts-morph resolver (for backward compatibility and simple operations)
   */
  static getTsMorphResolver(): TsMorphTypeResolver {
    if (!this.tsMorphResolver) {
      const project = new Project({
        compilerOptions: {
          target: ts.ScriptTarget.Latest,
          module: ts.ModuleKind.CommonJS,
          lib: ["lib.es2021.d.ts"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        }
      });
      
      this.tsMorphResolver = new TsMorphTypeResolver(project);
    }
    
    return this.tsMorphResolver;
  }

  /**
   * Clear cached resolvers and program
   */
  static clear(): void {
    this.compilerResolver = null;
    this.tsMorphResolver = null;
    this.program = null;
  }

  /**
   * Get the current TypeScript program (if using Compiler API)
   */
  static getProgram(): ts.Program | null {
    return this.program;
  }

  /**
   * Create a hybrid resolver that uses Compiler API for complex types
   * and ts-morph for basic operations
   */
  static getHybridResolver(files: string[]): ITypeResolver {
    const compilerResolver = this.getCompilerResolver(files);
    const tsMorphResolver = this.getTsMorphResolver();

    // Return a proxy that delegates to the appropriate resolver
    return new Proxy(compilerResolver, {
      get(target, prop) {
        // For complex type resolution, always use Compiler API
        if (prop === 'expandGeneric' || prop === 'resolveImportedType') {
          return target[prop as keyof typeof target];
        }
        
        // For other operations, can use either based on context
        return target[prop as keyof typeof target];
      }
    });
  }
}