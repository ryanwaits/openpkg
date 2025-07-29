import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { generateEnhancedSpec } from '../src/base-parser-enhanced';

const testDir = path.join(__dirname, 'temp-regression');

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

describe('Regression Tests: Complex Type Resolution', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  test('should handle deeply nested generic types', () => {
    const testFile = path.join(testDir, 'nested-generics.ts');
    fs.writeFileSync(testFile, `
      export type Result<T, E = Error> = 
        | { success: true; data: T }
        | { success: false; error: E };
      
      export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
      
      export type NestedResult<T> = Result<Result<T>>;
      
      export type DeeplyNested<T> = AsyncResult<NestedResult<T>>;
      
      export interface ApiResponse<T> {
        result: Result<T>;
        metadata: {
          timestamp: Date;
          version: string;
        };
      }
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      maxDepth: 5
    });

    const deeplyNested = spec.types.find(t => t.name === 'DeeplyNested');
    expect(deeplyNested).toBeDefined();
    expect(deeplyNested?.kind).toBe('type');
  });

  test('should handle recursive type definitions', () => {
    const testFile = path.join(testDir, 'recursive-types.ts');
    fs.writeFileSync(testFile, `
      export interface TreeNode<T> {
        value: T;
        children: TreeNode<T>[];
        parent?: TreeNode<T>;
      }
      
      export type LinkedList<T> = {
        value: T;
        next: LinkedList<T> | null;
      };
      
      export interface GraphNode {
        id: string;
        edges: GraphNode[];
        data: Record<string, GraphNode>;
      }
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      maxDepth: 3
    });

    const treeNode = spec.types.find(t => t.name === 'TreeNode');
    expect(treeNode).toBeDefined();
    expect(treeNode?.kind).toBe('interface');
    
    // Should not crash with recursive types
    const linkedList = spec.types.find(t => t.name === 'LinkedList');
    expect(linkedList).toBeDefined();
  });

  test('should handle conditional types', () => {
    const testFile = path.join(testDir, 'conditional-types.ts');
    fs.writeFileSync(testFile, `
      export type IsString<T> = T extends string ? true : false;
      
      export type ExtractArrayType<T> = T extends (infer U)[] ? U : never;
      
      export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
      
      export type DeepReadonly<T> = {
        readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
      };
      
      export type FunctionArgs<T> = T extends (...args: infer A) => any ? A : never;
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true
    });

    const isString = spec.types.find(t => t.name === 'IsString');
    expect(isString).toBeDefined();
    expect(isString?.kind).toBe('type');
    
    const deepReadonly = spec.types.find(t => t.name === 'DeepReadonly');
    expect(deepReadonly).toBeDefined();
  });

  test('should handle template literal types', () => {
    const testFile = path.join(testDir, 'template-literals.ts');
    fs.writeFileSync(testFile, `
      export type EventName = \`on\${string}\`;
      
      export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
      export type Route = \`/api/\${string}\`;
      export type Endpoint = \`\${HTTPMethod} \${Route}\`;
      
      export type CSSProperty = \`\${string}-\${string}\`;
      
      export type Greeting<T extends string> = \`Hello, \${T}!\`;
    `);

    const spec = generateEnhancedSpec(testFile);

    const eventName = spec.types.find(t => t.name === 'EventName');
    expect(eventName).toBeDefined();
    
    const endpoint = spec.types.find(t => t.name === 'Endpoint');
    expect(endpoint).toBeDefined();
  });

  test('should handle complex mapped types', () => {
    const testFile = path.join(testDir, 'mapped-types.ts');
    fs.writeFileSync(testFile, `
      export type Getters<T> = {
        [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K]
      };
      
      export type Setters<T> = {
        [K in keyof T as \`set\${Capitalize<string & K>}\`]: (value: T[K]) => void
      };
      
      export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
      
      export type RequireAtLeastOne<T> = {
        [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>
      }[keyof T];
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true
    });

    const getters = spec.types.find(t => t.name === 'Getters');
    expect(getters).toBeDefined();
    
    const requireAtLeastOne = spec.types.find(t => t.name === 'RequireAtLeastOne');
    expect(requireAtLeastOne).toBeDefined();
  });

  test('should handle complex union and intersection types', () => {
    const testFile = path.join(testDir, 'union-intersection.ts');
    fs.writeFileSync(testFile, `
      export interface A {
        a: string;
        common: number;
      }
      
      export interface B {
        b: string;
        common: number;
      }
      
      export interface C {
        c: string;
        common: number;
      }
      
      export type Union = A | B | C;
      export type Intersection = A & B & C;
      
      export type ComplexUnion = 
        | { type: 'text'; value: string }
        | { type: 'number'; value: number; min?: number; max?: number }
        | { type: 'boolean'; value: boolean }
        | { type: 'array'; items: ComplexUnion[] }
        | { type: 'object'; properties: Record<string, ComplexUnion> };
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true
    });

    const union = spec.types.find(t => t.name === 'Union');
    expect(union).toBeDefined();
    
    const intersection = spec.types.find(t => t.name === 'Intersection');
    expect(intersection).toBeDefined();
    
    const complexUnion = spec.types.find(t => t.name === 'ComplexUnion');
    expect(complexUnion).toBeDefined();
  });

  test('should handle variance annotations and modifiers', () => {
    const testFile = path.join(testDir, 'variance.ts');
    fs.writeFileSync(testFile, `
      export interface Container<out T> {
        readonly value: T;
      }
      
      export interface Processor<in T> {
        process(value: T): void;
      }
      
      export interface Transformer<in T, out R> {
        transform(input: T): R;
      }
      
      export type ReadonlyDeep<T> = {
        readonly [P in keyof T]: T[P] extends object ? ReadonlyDeep<T[P]> : T[P];
      };
    `);

    const spec = generateEnhancedSpec(testFile);

    const container = spec.types.find(t => t.name === 'Container');
    expect(container).toBeDefined();
    
    const transformer = spec.types.find(t => t.name === 'Transformer');
    expect(transformer).toBeDefined();
  });

  test('should handle index signatures and symbol keys', () => {
    const testFile = path.join(testDir, 'index-signatures.ts');
    fs.writeFileSync(testFile, `
      export interface StringIndex {
        [key: string]: any;
        length: number;
      }
      
      export interface NumberIndex {
        [index: number]: string;
        length: number;
      }
      
      export interface SymbolIndex {
        [key: symbol]: unknown;
        name: string;
      }
      
      export type RecordLike<K extends string | number | symbol, V> = {
        [P in K]: V;
      };
    `);

    const spec = generateEnhancedSpec(testFile);

    const stringIndex = spec.types.find(t => t.name === 'StringIndex');
    expect(stringIndex).toBeDefined();
    
    const symbolIndex = spec.types.find(t => t.name === 'SymbolIndex');
    expect(symbolIndex).toBeDefined();
  });

  test('should handle complex class hierarchies', () => {
    const testFile = path.join(testDir, 'class-hierarchy.ts');
    fs.writeFileSync(testFile, `
      export abstract class Animal {
        abstract makeSound(): string;
        move(distance: number): void {
          console.log(\`Moved \${distance}m\`);
        }
      }
      
      export interface Flyable {
        fly(height: number): void;
      }
      
      export interface Swimmable {
        swim(depth: number): void;
      }
      
      export class Bird extends Animal implements Flyable {
        makeSound(): string {
          return "Tweet";
        }
        
        fly(height: number): void {
          console.log(\`Flying at \${height}m\`);
        }
      }
      
      export class Duck extends Bird implements Swimmable {
        swim(depth: number): void {
          console.log(\`Swimming at \${depth}m depth\`);
        }
      }
    `);

    const spec = generateEnhancedSpec(testFile, {
      includeTypeHierarchy: true
    });

    const duck = spec.types.find(t => t.name === 'Duck');
    expect(duck).toBeDefined();
    expect(duck?.kind).toBe('class');
    
    // Should include extends information
    if ('extends' in duck!) {
      expect(duck.extends).toContain('Bird');
    }
  });

  test('should handle tuple types and rest elements', () => {
    const testFile = path.join(testDir, 'tuples.ts');
    fs.writeFileSync(testFile, `
      export type Point2D = [number, number];
      export type Point3D = [number, number, number];
      
      export type NamedPoint = [x: number, y: number, name?: string];
      
      export type RestTuple = [string, ...number[], boolean];
      
      export type MixedTuple = [
        string,
        number,
        ...Array<{ id: number; name: string }>,
        boolean?
      ];
      
      export function processPoint([x, y]: Point2D): number {
        return x + y;
      }
    `);

    const spec = generateEnhancedSpec(testFile);

    const point2D = spec.types.find(t => t.name === 'Point2D');
    expect(point2D).toBeDefined();
    
    const restTuple = spec.types.find(t => t.name === 'RestTuple');
    expect(restTuple).toBeDefined();
    
    const processPoint = spec.exports.find(e => e.name === 'processPoint');
    expect(processPoint).toBeDefined();
  });
});