import { describe, test, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { createCompilerAPIService } from '../src/services/compiler-api';
import { SymbolResolver } from '../src/services/symbol-resolver';
import { TypeInferenceService } from '../src/services/type-inference';
import { TypeCache } from '../src/services/type-cache';
import { ErrorHandler } from '../src/services/error-handler';

const testDir = path.join(__dirname, 'temp-phase3');
const ensureTestDir = () => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
};

const cleanupTestDir = () => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
};

function setupTest(files: Record<string, string>) {
  ensureTestDir();
  
  const filePaths: string[] = [];
  for (const [fileName, content] of Object.entries(files)) {
    const filePath = path.join(testDir, fileName);
    fs.writeFileSync(filePath, content);
    filePaths.push(filePath);
  }
  
  const service = createCompilerAPIService();
  const program = service.createProgram(filePaths);
  const typeChecker = service.getTypeChecker();
  
  return { 
    program, 
    typeChecker, 
    symbolResolver: new SymbolResolver(typeChecker),
    typeInference: new TypeInferenceService(typeChecker),
    typeCache: new TypeCache(),
    errorHandler: new ErrorHandler(),
    filePaths 
  };
}

describe('Phase 3: Advanced Features', () => {
  beforeEach(() => {
    cleanupTestDir();
  });

  describe('Symbol Resolution', () => {
    test('should extract JSDoc comments from symbols', () => {
      const { program, symbolResolver } = setupTest({
        'jsdoc.ts': `
          /**
           * Calculates the sum of two numbers
           * @param a The first number
           * @param b The second number
           * @returns The sum of a and b
           * @example
           * const result = add(2, 3); // returns 5
           * @since 1.0.0
           * @see subtract
           */
          export function add(a: number, b: number): number {
            return a + b;
          }
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'jsdoc.ts'))!;
      const funcDecl = sourceFile.statements.find(ts.isFunctionDeclaration) as ts.FunctionDeclaration;
      
      const jsDoc = symbolResolver.getJSDocFromNode(funcDecl);
      
      expect(jsDoc).toBeDefined();
      expect(jsDoc!.description).toContain('Calculates the sum');
      expect(jsDoc!.params.get('a')).toBe('The first number');
      expect(jsDoc!.params.get('b')).toBe('The second number');
      expect(jsDoc!.returns).toBe('The sum of a and b');
      expect(jsDoc!.examples).toHaveLength(1);
      expect(jsDoc!.since).toBe('1.0.0');
      expect(jsDoc!.see).toContain('subtract');
    });

    test('should handle symbol aliases', () => {
      const { program, symbolResolver } = setupTest({
        'original.ts': `
          export interface User {
            id: string;
            name: string;
          }
        `,
        'alias.ts': `
          import { User as AppUser } from './original';
          export { AppUser };
        `
      });

      const aliasFile = program.getSourceFile(path.join(testDir, 'alias.ts'))!;
      const exportStmt = aliasFile.statements.find(ts.isExportDeclaration) as ts.ExportDeclaration;
      
      if (exportStmt.exportClause && ts.isNamedExports(exportStmt.exportClause)) {
        const exportSpec = exportStmt.exportClause.elements[0];
        const symbol = symbolResolver.getSymbolAtLocation(exportSpec.name);
        
        expect(symbol).toBeDefined();
        const resolvedSymbol = symbolResolver.resolveAlias(symbol!);
        expect(resolvedSymbol.getName()).toBe('User');
      }
    });

    test('should detect declaration merging', () => {
      const { program, symbolResolver, typeChecker } = setupTest({
        'merge.ts': `
          interface Config {
            apiUrl: string;
          }
          
          interface Config {
            timeout: number;
          }
          
          namespace Config {
            export const defaults = {
              apiUrl: 'http://localhost',
              timeout: 5000
            };
          }
          
          export { Config };
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'merge.ts'))!;
      const firstInterface = sourceFile.statements.find(ts.isInterfaceDeclaration) as ts.InterfaceDeclaration;
      const symbol = typeChecker.getSymbolAtLocation(firstInterface.name);
      
      if (symbol) {
        expect(symbolResolver.isDeclarationMerge(symbol)).toBe(true);
        const mergedSymbols = symbolResolver.getMergedSymbols(symbol);
        expect(mergedSymbols.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Type Inference', () => {
    test('should handle inferred return types', () => {
      const { program, typeInference } = setupTest({
        'infer.ts': `
          // Inferred return type
          export function multiply(a: number, b: number) {
            return a * b;
          }
          
          // Explicit return type
          export function divide(a: number, b: number): number {
            return a / b;
          }
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'infer.ts'))!;
      const functions = sourceFile.statements.filter(ts.isFunctionDeclaration) as ts.FunctionDeclaration[];
      
      const multiply = functions.find(f => f.name?.text === 'multiply')!;
      const divide = functions.find(f => f.name?.text === 'divide')!;
      
      expect(typeInference.isInferredReturnType(multiply)).toBe(true);
      expect(typeInference.isInferredReturnType(divide)).toBe(false);
      
      const inferredType = typeInference.getInferredReturnType(multiply);
      expect(inferredType).toBeDefined();
    });

    test('should handle type predicates', () => {
      const { program, typeInference } = setupTest({
        'guards.ts': `
          interface Dog {
            bark(): void;
          }
          
          interface Cat {
            meow(): void;
          }
          
          export function isDog(pet: Dog | Cat): pet is Dog {
            return 'bark' in pet;
          }
          
          export function isString(value: unknown): value is string {
            return typeof value === 'string';
          }
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'guards.ts'))!;
      const functions = sourceFile.statements.filter(ts.isFunctionDeclaration) as ts.FunctionDeclaration[];
      
      for (const func of functions) {
        expect(typeInference.isTypeGuard(func)).toBe(true);
        
        const predicate = typeInference.getTypePredicate(func);
        expect(predicate).toBeDefined();
        expect(predicate!.type).toBeDefined();
      }
    });

    test('should infer types from usage', () => {
      const { program, typeInference, typeChecker } = setupTest({
        'infer-usage.ts': `
          // Inferred from initializer
          const config = {
            apiUrl: 'https://api.example.com',
            timeout: 5000,
            retries: 3
          };
          
          // Inferred array type
          const numbers = [1, 2, 3, 4, 5];
          
          // Inferred from function call
          const result = Math.max(...numbers);
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'infer-usage.ts'))!;
      const varStmt = sourceFile.statements[0] as ts.VariableStatement;
      const configDecl = varStmt.declarationList.declarations[0];
      
      const inferredType = typeInference.inferTypeFromAssignment(configDecl);
      expect(inferredType).toBeDefined();
      
      // Check that it inferred an object type with properties
      const props = inferredType!.getProperties();
      expect(props.length).toBe(3);
      expect(props.some(p => p.getName() === 'apiUrl')).toBe(true);
    });
  });

  describe('Caching', () => {
    test('should cache type resolution results', () => {
      const { program, typeCache, typeChecker } = setupTest({
        'cache.ts': `
          export interface User {
            id: string;
            name: string;
            email: string;
          }
          
          export type UserList = User[];
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'cache.ts'))!;
      const userInterface = sourceFile.statements.find(ts.isInterfaceDeclaration) as ts.InterfaceDeclaration;
      
      // First resolution (cache miss)
      const result1 = typeCache.getOrResolveType(userInterface, () => ({
        typeString: 'User',
        isGeneric: false,
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: true,
        isFunction: false
      }));
      
      // Second resolution (cache hit)
      const result2 = typeCache.getOrResolveType(userInterface, () => {
        throw new Error('Should not be called - should use cache');
      });
      
      expect(result1).toEqual(result2);
      
      const stats = typeCache.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    test('should warm up cache', () => {
      const { program, typeCache, typeChecker } = setupTest({
        'warmup.ts': `
          export interface Config {
            apiUrl: string;
          }
          
          export class Service {
            constructor(private config: Config) {}
          }
          
          export type ServiceFactory = () => Service;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'warmup.ts'))!;
      
      // Warm up cache
      typeCache.warmUp([sourceFile], typeChecker);
      
      const stats = typeCache.getStats();
      expect(stats.symbolsCached).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle type resolution errors gracefully', () => {
      // Create error handler directly without setupTest since we don't need files
      const errorHandler = new ErrorHandler({ showWarnings: true });
      
      const error = new Error('Type resolution failed');
      errorHandler.handleTypeResolutionError(error, undefined, 'test context');
      
      expect(errorHandler.hasErrors()).toBe(true);
      
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Type resolution failed');
      expect(errors[0].context).toBe('test context');
    });

    test('should handle with fallback', () => {
      // Create error handler directly without setupTest since we don't need files
      const errorHandler = new ErrorHandler({ showWarnings: true });
      
      const result = errorHandler.handleWithFallback(
        () => {
          throw new Error('Operation failed');
        },
        'fallback value',
        'test operation'
      );
      
      expect(result).toBe('fallback value');
      expect(errorHandler.hasErrors()).toBe(true);
    });

    test('should format errors nicely', () => {
      // Create error handler directly without setupTest since we don't need files
      const errorHandler = new ErrorHandler({ showWarnings: true });
      
      errorHandler.handleTypeResolutionError(
        new Error('Test error'),
        undefined,
        'formatting test'
      );
      
      const errors = errorHandler.getErrors();
      const formatted = errorHandler.formatError(errors[0]);
      
      expect(formatted).toContain('error');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('TYPE_RESOLUTION_ERROR');
    });

    test('should provide error summary', () => {
      const { program, errorHandler, typeChecker } = setupTest({
        'errors.ts': `
          // This will cause a TypeScript error
          const x: string = 123;
          
          // Another error
          function test(): number {
            return "not a number";
          }
        `
      });

      // Get diagnostics
      const diagnostics = [
        ...program.getSemanticDiagnostics(),
        ...program.getSyntacticDiagnostics()
      ];
      
      diagnostics.forEach(d => errorHandler.handleDiagnostic(d));
      
      const summary = errorHandler.getSummary();
      expect(summary.totalErrors).toBeGreaterThan(0);
      expect(summary.errorsByType['typescript-diagnostic']).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    test('should work together for complex type analysis', () => {
      const { program, symbolResolver, typeInference, typeCache, typeChecker } = setupTest({
        'complex.ts': `
          /**
           * User management service
           * @since 2.0.0
           */
          export class UserService {
            private users = new Map<string, User>();
            
            /**
             * Add a new user
             * @param user The user to add
             * @returns The user ID
             */
            addUser(user: User) {
              const id = crypto.randomUUID();
              this.users.set(id, user);
              return id;
            }
            
            /**
             * Find a user by ID
             * @param id The user ID
             * @returns The user if found
             */
            findUser(id: string): User | undefined {
              return this.users.get(id);
            }
          }
          
          interface User {
            name: string;
            email: string;
            role: 'admin' | 'user';
          }
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'complex.ts'))!;
      
      // Warm up cache
      typeCache.warmUp([sourceFile], typeChecker);
      
      // Find the class
      const classDecl = sourceFile.statements.find(ts.isClassDeclaration) as ts.ClassDeclaration;
      
      // Get JSDoc
      const classJsDoc = symbolResolver.getJSDocFromNode(classDecl);
      expect(classJsDoc?.since).toBe('2.0.0');
      
      // Check methods
      const addUserMethod = classDecl.members.find(
        m => ts.isMethodDeclaration(m) && m.name?.getText() === 'addUser'
      ) as ts.MethodDeclaration;
      
      // Check inferred return type
      expect(typeInference.isInferredReturnType(addUserMethod)).toBe(true);
      
      // Get method JSDoc
      const methodJsDoc = symbolResolver.getJSDocFromNode(addUserMethod);
      expect(methodJsDoc?.description).toContain('Add a new user');
      expect(methodJsDoc?.returns).toBe('The user ID');
    });
  });

  cleanupTestDir();
});