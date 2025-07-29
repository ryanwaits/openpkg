import { describe, test, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { createCompilerAPIService } from '../src/services/compiler-api';
import { CompilerAPITypeResolver } from '../src/services/type-resolver-compiler';
import { EnhancedTypeResolution } from '../src/services/type-resolution-enhanced';
import { ModuleResolver } from '../src/services/module-resolver';
import * as ts from 'typescript';

// Test helpers
const testDir = path.join(__dirname, 'temp-phase2');
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

// Helper to create test files and get resolver
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
  const resolver = new CompilerAPITypeResolver(typeChecker);
  const enhanced = new EnhancedTypeResolution(typeChecker);
  const moduleResolver = new ModuleResolver(program);
  
  return { program, typeChecker, resolver, enhanced, moduleResolver, filePaths };
}

describe('Phase 2: Core Type Resolution', () => {
  beforeEach(() => {
    cleanupTestDir();
  });

  describe('Utility Types', () => {
    test('should expand Partial<T> type', () => {
      const { program, resolver } = setupTest({
        'partial.ts': `
          interface User {
            id: string;
            name: string;
            email: string;
            age: number;
          }
          
          export type PartialUser = Partial<User>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'partial.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'PartialUser'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(typeAlias);
      expect(resolved.isObject).toBe(true);
      expect(resolved.properties).toBeDefined();
      expect(resolved.properties?.length).toBe(4);
      
      // All properties should be optional in Partial<User>
      expect(resolved.properties?.every(p => p.optional)).toBe(true);
    });

    test('should expand Required<T> type', () => {
      const { program, resolver } = setupTest({
        'required.ts': `
          interface User {
            id?: string;
            name?: string;
            email?: string;
          }
          
          export type RequiredUser = Required<User>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'required.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'RequiredUser'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(typeAlias);
      expect(resolved.properties).toBeDefined();
      
      // All properties should be required in Required<User>
      expect(resolved.properties?.every(p => !p.optional)).toBe(true);
    });

    test('should expand Pick<T, K> type', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'pick.ts': `
          interface User {
            id: string;
            name: string;
            email: string;
            age: number;
          }
          
          export type UserBasic = Pick<User, 'id' | 'name'>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'pick.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'UserBasic'
      ) as ts.TypeAliasDeclaration;

      const type = typeChecker.getTypeAtLocation(typeAlias);
      const properties = enhanced.resolveMappedType(type);
      
      expect(properties.length).toBe(2);
      expect(properties.find(p => p.name === 'id')).toBeDefined();
      expect(properties.find(p => p.name === 'name')).toBeDefined();
      expect(properties.find(p => p.name === 'email')).toBeUndefined();
    });

    test('should expand Record<K, T> type', () => {
      const { program, resolver } = setupTest({
        'record.ts': `
          export type StringRecord = Record<string, number>;
          export type UserRoles = Record<'admin' | 'user' | 'guest', boolean>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'record.ts'))!;
      const stringRecord = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'StringRecord'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(stringRecord);
      expect(resolved.isObject).toBe(true);
    });
  });

  describe('Mapped Types', () => {
    test('should resolve custom mapped types', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'mapped.ts': `
          type Readonly<T> = {
            readonly [P in keyof T]: T[P];
          };
          
          interface User {
            name: string;
            age: number;
          }
          
          export type ReadonlyUser = Readonly<User>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'mapped.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'ReadonlyUser'
      ) as ts.TypeAliasDeclaration;

      const type = typeChecker.getTypeAtLocation(typeAlias);
      const properties = enhanced.resolveMappedType(type);
      
      expect(properties.length).toBe(2);
      expect(properties.every(p => p.readonly)).toBe(true);
    });
  });

  describe('Conditional Types', () => {
    test('should resolve conditional types', () => {
      const { program, resolver } = setupTest({
        'conditional.ts': `
          type IsString<T> = T extends string ? true : false;
          
          export type Test1 = IsString<string>;
          export type Test2 = IsString<number>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'conditional.ts'))!;
      const test1 = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'Test1'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(test1);
      expect(resolved.typeString).toBe('true');
    });

    test('should handle complex conditional types', () => {
      const { program, resolver } = setupTest({
        'complex-conditional.ts': `
          type ExtractArrayElement<T> = T extends (infer U)[] ? U : never;
          
          export type ElementType = ExtractArrayElement<string[]>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'complex-conditional.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'ElementType'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(typeAlias);
      expect(resolved.typeString).toBe('string');
    });
  });

  describe('Promise and Array Types', () => {
    test('should resolve Promise<T> types', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'promise.ts': `
          export async function fetchUser(): Promise<{ id: string; name: string }> {
            return { id: '1', name: 'John' };
          }
          
          export type UserPromise = Promise<{ id: string; name: string }>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'promise.ts'))!;
      const typeAlias = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'UserPromise'
      ) as ts.TypeAliasDeclaration;

      const type = typeChecker.getTypeAtLocation(typeAlias);
      expect(enhanced.isPromiseType(type)).toBe(true);
      
      const resolvedType = enhanced.getPromiseResolvedType(type);
      expect(resolvedType).toBeDefined();
    });

    test('should handle nested generic types', () => {
      const { program, resolver } = setupTest({
        'nested.ts': `
          export type NestedArray = Array<Array<string>>;
          export type PromiseArray = Promise<Array<number>>;
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'nested.ts'))!;
      const nestedArray = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'NestedArray'
      ) as ts.TypeAliasDeclaration;

      const resolved = resolver.resolveType(nestedArray);
      expect(resolved.isArray).toBe(true);
      expect(resolved.elementType?.isArray).toBe(true);
      expect(resolved.elementType?.elementType?.isPrimitive).toBe(true);
      expect(resolved.elementType?.elementType?.typeString).toBe('string');
    });
  });

  describe('Tuple Types', () => {
    test('should resolve tuple types', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'tuple.ts': `
          export type Point2D = [number, number];
          export type UserTuple = [string, number, boolean];
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'tuple.ts'))!;
      const point2D = sourceFile.statements.find(
        stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'Point2D'
      ) as ts.TypeAliasDeclaration;

      const type = typeChecker.getTypeAtLocation(point2D);
      expect(enhanced.isTupleType(type)).toBe(true);
      
      const elements = enhanced.getTupleElements(type);
      expect(elements.length).toBe(2);
      expect(elements.every(el => typeChecker.typeToString(el) === 'number')).toBe(true);
    });
  });

  describe('Inherited Properties', () => {
    test('should get inherited properties from base classes', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'inheritance.ts': `
          class Animal {
            name: string = '';
            age: number = 0;
          }
          
          class Dog extends Animal {
            breed: string = '';
          }
          
          export { Dog };
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'inheritance.ts'))!;
      const dogClass = sourceFile.statements.find(
        stmt => ts.isClassDeclaration(stmt) && stmt.name?.text === 'Dog'
      ) as ts.ClassDeclaration;

      const type = typeChecker.getTypeAtLocation(dogClass);
      const allProperties = enhanced.getAllProperties(type);
      
      expect(allProperties.length).toBe(3);
      expect(allProperties.find(p => p.name === 'name')).toBeDefined();
      expect(allProperties.find(p => p.name === 'age')).toBeDefined();
      expect(allProperties.find(p => p.name === 'breed')).toBeDefined();
    });

    test('should get inherited properties from interfaces', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'interface-inheritance.ts': `
          interface Shape {
            color: string;
          }
          
          interface Rectangle extends Shape {
            width: number;
            height: number;
          }
          
          export { Rectangle };
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'interface-inheritance.ts'))!;
      const rectangleInterface = sourceFile.statements.find(
        stmt => ts.isInterfaceDeclaration(stmt) && stmt.name.text === 'Rectangle'
      ) as ts.InterfaceDeclaration;

      const type = typeChecker.getTypeAtLocation(rectangleInterface);
      const allProperties = enhanced.getAllProperties(type);
      
      expect(allProperties.length).toBe(3);
      expect(allProperties.find(p => p.name === 'color')).toBeDefined();
      expect(allProperties.find(p => p.name === 'width')).toBeDefined();
      expect(allProperties.find(p => p.name === 'height')).toBeDefined();
    });
  });

  describe('Index Signatures', () => {
    test('should handle index signatures', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'index-signatures.ts': `
          interface StringDictionary {
            [key: string]: string;
          }
          
          interface NumberDictionary {
            [index: number]: string;
            length: number;
          }
          
          export { StringDictionary, NumberDictionary };
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'index-signatures.ts'))!;
      const stringDict = sourceFile.statements.find(
        stmt => ts.isInterfaceDeclaration(stmt) && stmt.name.text === 'StringDictionary'
      ) as ts.InterfaceDeclaration;

      const type = typeChecker.getTypeAtLocation(stringDict);
      const indexSignatures = enhanced.getIndexSignatures(type);
      
      expect(indexSignatures.string).toBeDefined();
      expect(indexSignatures.string?.typeString).toBe('string');
    });
  });

  describe('Method Signatures', () => {
    test('should extract method signatures with parameters', () => {
      const { program, typeChecker, enhanced } = setupTest({
        'methods.ts': `
          interface Calculator {
            add(a: number, b: number): number;
            subtract(x: number, y: number): number;
            multiply(factor1: number, factor2: number): Promise<number>;
          }
          
          export { Calculator };
        `
      });

      const sourceFile = program.getSourceFile(path.join(testDir, 'methods.ts'))!;
      const calcInterface = sourceFile.statements.find(
        stmt => ts.isInterfaceDeclaration(stmt) && stmt.name.text === 'Calculator'
      ) as ts.InterfaceDeclaration;

      const type = typeChecker.getTypeAtLocation(calcInterface);
      const methods = enhanced.getMethodSignatures(type);
      
      expect(methods.length).toBe(3);
      
      const addMethod = methods.find(m => m.name === 'add');
      expect(addMethod).toBeDefined();
      expect(addMethod?.parameters.length).toBe(2);
      expect(addMethod?.returnType.typeString).toBe('number');
      
      const multiplyMethod = methods.find(m => m.name === 'multiply');
      expect(multiplyMethod?.returnType.typeString).toContain('Promise');
    });
  });

  describe('Module Resolution', () => {
    test('should resolve imports from other files', () => {
      const { moduleResolver, filePaths } = setupTest({
        'types.ts': `
          export interface User {
            id: string;
            name: string;
          }
          
          export type UserId = string;
        `,
        'main.ts': `
          import { User, UserId } from './types';
          
          export const user: User = {
            id: '1',
            name: 'John'
          };
        `
      });

      const mainFile = filePaths.find(f => f.endsWith('main.ts'))!;
      const program = moduleResolver['program'];
      const sourceFile = program.getSourceFile(mainFile)!;
      
      const imports = moduleResolver.getFileImports(sourceFile);
      expect(imports.length).toBe(1);
      expect(imports[0].moduleName).toBe('./types');
      expect(imports[0].imports.length).toBe(2);
    });

    test('should resolve re-exported types', () => {
      const { moduleResolver, filePaths } = setupTest({
        'core.ts': `
          export interface CoreUser {
            id: string;
          }
        `,
        'index.ts': `
          export { CoreUser as User } from './core';
          export * from './core';
        `
      });

      const indexFile = filePaths.find(f => f.endsWith('index.ts'))!;
      const program = moduleResolver['program'];
      const sourceFile = program.getSourceFile(indexFile)!;
      
      const reExports = moduleResolver.resolveReExports(sourceFile);
      expect(reExports.has('User')).toBe(true);
      expect(reExports.get('User')?.originalName).toBe('CoreUser');
    });

    test('should handle namespace imports', () => {
      const { moduleResolver, filePaths } = setupTest({
        'utils.ts': `
          export function helper() {}
          export const constant = 42;
        `,
        'main.ts': `
          import * as utils from './utils';
        `
      });

      const mainFile = filePaths.find(f => f.endsWith('main.ts'))!;
      const program = moduleResolver['program'];
      const sourceFile = program.getSourceFile(mainFile)!;
      
      const imports = moduleResolver.getFileImports(sourceFile);
      expect(imports[0].imports[0].name).toBe('*');
      expect(imports[0].imports[0].alias).toBe('utils');
    });
  });

  cleanupTestDir();
});