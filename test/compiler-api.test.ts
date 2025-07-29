import { describe, test, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { createCompilerAPIService, loadTsConfig } from '../src/services/compiler-api';
import { TypeResolverFactory } from '../src/services/type-resolver-factory';
import { CompilerAPITypeResolver } from '../src/services/type-resolver-compiler';
import { TypeWalkerImpl } from '../src/services/type-walker';

// Helper to create temporary test files
const testDir = path.join(__dirname, 'temp');
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

describe('Compiler API Service', () => {
  beforeEach(() => {
    ensureTestDir();
  });

  test('should create program with valid TypeScript file', () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    
    expect(program).toBeDefined();
    expect(service.getTypeChecker()).toBeDefined();
    expect(service.getSourceFile(testFile)).toBeDefined();
  });

  test('should throw error for non-existent file', () => {
    const service = createCompilerAPIService();
    
    expect(() => {
      service.createProgram(['/non/existent/file.ts']);
    }).toThrow('File validation failed');
  });

  test('should throw error for non-TypeScript file', () => {
    const testFile = path.join(testDir, 'test.js');
    fs.writeFileSync(testFile, 'console.log("test")');

    const service = createCompilerAPIService();
    
    expect(() => {
      service.createProgram([testFile]);
    }).toThrow('Not a TypeScript file');
  });

  test('should load tsconfig.json if present', () => {
    const tsConfigPath = path.join(testDir, 'tsconfig.json');
    fs.writeFileSync(tsConfigPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        strict: true,
        module: 'commonjs'
      }
    }));

    const options = loadTsConfig(testDir);
    
    expect(options).toBeDefined();
    expect(options?.target).toBe(7); // ES2020
    expect(options?.strict).toBe(true);
  });

  cleanupTestDir();
});

describe('Type Resolver', () => {
  beforeEach(() => {
    ensureTestDir();
  });

  test('should resolve primitive types', () => {
    const testFile = path.join(testDir, 'primitives.ts');
    fs.writeFileSync(testFile, `
      export const str: string = "hello";
      export const num: number = 42;
      export const bool: boolean = true;
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const sourceFile = service.getSourceFile(testFile)!;
    
    const resolver = new CompilerAPITypeResolver(typeChecker);
    
    // Find the string variable declaration
    const varDecl = sourceFile.statements.find(stmt => 
      stmt.kind === 243 && // VariableStatement
      (stmt as any).declarationList.declarations[0].name.text === 'str'
    );

    if (varDecl) {
      const resolved = resolver.resolveType((varDecl as any).declarationList.declarations[0]);
      expect(resolved.isPrimitive).toBe(true);
      expect(resolved.typeString).toBe('string');
    }
  });

  test('should resolve array types', () => {
    const testFile = path.join(testDir, 'arrays.ts');
    fs.writeFileSync(testFile, `
      export const numbers: number[] = [1, 2, 3];
      export const strings: Array<string> = ["a", "b", "c"];
    `);

    const resolver = TypeResolverFactory.getCompilerResolver([testFile]);
    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const sourceFile = service.getSourceFile(testFile)!;
    
    // Test array resolution
    const varDecl = sourceFile.statements[0] as any;
    if (varDecl.declarationList) {
      const resolved = resolver.resolveType(varDecl.declarationList.declarations[0]);
      expect(resolved.isArray).toBe(true);
      expect(resolved.elementType).toBeDefined();
      expect(resolved.elementType?.isPrimitive).toBe(true);
      expect(resolved.elementType?.typeString).toBe('number');
    }
  });

  test('should resolve union types', () => {
    const testFile = path.join(testDir, 'unions.ts');
    fs.writeFileSync(testFile, `
      export type StringOrNumber = string | number;
      export const value: StringOrNumber = "test";
    `);

    const resolver = TypeResolverFactory.getCompilerResolver([testFile]);
    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const sourceFile = service.getSourceFile(testFile)!;
    
    // Find type alias
    const typeAlias = sourceFile.statements.find(stmt => 
      stmt.kind === 262 // TypeAliasDeclaration
    );

    if (typeAlias) {
      const resolved = resolver.resolveType(typeAlias);
      expect(resolved.isUnion).toBe(true);
      expect(resolved.unionTypes).toBeDefined();
      expect(resolved.unionTypes?.length).toBe(2);
    }
  });

  test('should expand generic types like Partial<T>', () => {
    const testFile = path.join(testDir, 'generics.ts');
    fs.writeFileSync(testFile, `
      interface User {
        id: string;
        name: string;
        email: string;
      }
      
      export type PartialUser = Partial<User>;
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const sourceFile = service.getSourceFile(testFile)!;
    
    const resolver = new CompilerAPITypeResolver(typeChecker);
    
    // Find the type alias
    const typeAlias = sourceFile.statements.find(stmt => 
      stmt.kind === 262 && // TypeAliasDeclaration
      (stmt as any).name.text === 'PartialUser'
    );

    if (typeAlias) {
      const type = typeChecker.getTypeAtLocation(typeAlias);
      const expanded = resolver.expandGeneric(type);
      
      expect(expanded.expanded.properties).toBeDefined();
      expect(expanded.expanded.properties?.length).toBe(3);
      expect(expanded.expanded.properties?.every(p => p.optional)).toBe(true);
    }
  });

  cleanupTestDir();
});

describe('Type Walker', () => {
  beforeEach(() => {
    ensureTestDir();
  });

  test('should walk interface types recursively', () => {
    const testFile = path.join(testDir, 'interfaces.ts');
    fs.writeFileSync(testFile, `
      interface Address {
        street: string;
        city: string;
        country: string;
      }
      
      interface User {
        id: string;
        name: string;
        address: Address;
      }
      
      export type UserWithOptionalAddress = User & { address?: Address };
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const sourceFile = service.getSourceFile(testFile)!;
    
    const walker = new TypeWalkerImpl(typeChecker);
    
    // Find User interface
    const userInterface = sourceFile.statements.find(stmt => 
      stmt.kind === 264 && // InterfaceDeclaration
      (stmt as any).name.text === 'User'
    );

    if (userInterface) {
      const type = typeChecker.getTypeAtLocation(userInterface);
      const structure = walker.walk(type, 0);
      
      expect(structure.kind).toBe('interface');
      expect(structure.properties).toBeDefined();
      expect(structure.properties?.length).toBe(3);
      
      const addressProp = structure.properties?.find(p => p.name === 'address');
      expect(addressProp).toBeDefined();
    }
  });

  test('should handle circular type references', () => {
    const testFile = path.join(testDir, 'circular.ts');
    fs.writeFileSync(testFile, `
      interface Node {
        value: string;
        children: Node[];
      }
      
      export const tree: Node = {
        value: "root",
        children: []
      };
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const sourceFile = service.getSourceFile(testFile)!;
    
    const walker = new TypeWalkerImpl(typeChecker);
    
    // Find Node interface
    const nodeInterface = sourceFile.statements.find(stmt => 
      stmt.kind === 264 // InterfaceDeclaration
    );

    if (nodeInterface) {
      const type = typeChecker.getTypeAtLocation(nodeInterface);
      const structure = walker.walk(type, 0);
      
      expect(structure.kind).toBe('interface');
      expect(structure.properties).toBeDefined();
      // Should not infinitely recurse
      expect(structure.depth).toBeLessThan(10);
    }
  });

  cleanupTestDir();
});

describe('Type Resolution Factory', () => {
  beforeEach(() => {
    ensureTestDir();
    TypeResolverFactory.clear();
  });

  test('should create and cache compiler resolver', () => {
    const testFile = path.join(testDir, 'factory.ts');
    fs.writeFileSync(testFile, `
      export const test = "hello";
    `);

    const resolver1 = TypeResolverFactory.getCompilerResolver([testFile]);
    const resolver2 = TypeResolverFactory.getCompilerResolver([testFile]);
    
    expect(resolver1).toBe(resolver2); // Should be cached
  });

  test('should create hybrid resolver', () => {
    const testFile = path.join(testDir, 'hybrid.ts');
    fs.writeFileSync(testFile, `
      export interface Test {
        value: string;
      }
    `);

    const resolver = TypeResolverFactory.getHybridResolver([testFile]);
    
    expect(resolver).toBeDefined();
    expect(resolver.resolveType).toBeDefined();
    expect(resolver.expandGeneric).toBeDefined();
  });

  cleanupTestDir();
});