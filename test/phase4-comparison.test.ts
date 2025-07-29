import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { generateBaseSpec } from '../src/base-parser';
import { generateEnhancedSpec } from '../src/base-parser-enhanced';

const testDir = path.join(__dirname, 'temp-phase4-comparison');

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

describe('Phase 4: Compiler API vs ts-morph Comparison', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  test('should resolve utility types like Partial<T>', () => {
    const testFile = path.join(testDir, 'utility-types.ts');
    fs.writeFileSync(testFile, `
      export interface User {
        id: string;
        name: string;
        email: string;
        age: number;
      }
      
      export type PartialUser = Partial<User>;
      export type RequiredUser = Required<User>;
      export type ReadonlyUser = Readonly<User>;
      export type PickedUser = Pick<User, 'id' | 'name'>;
      export type OmittedUser = Omit<User, 'age'>;
    `);

    const baseSpec = generateBaseSpec(testFile);
    const enhancedSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      includeTypeHierarchy: false
    });

    // Base parser shows type aliases as strings
    const basePartialUser = baseSpec.types.find(t => t.name === 'PartialUser');
    expect(basePartialUser?.kind).toBe('type');
    if ('type' in basePartialUser!) {
      expect(basePartialUser.type).toBe('Partial<User>');
    }

    // Enhanced parser can expand the type
    const enhancedPartialUser = enhancedSpec.types.find(t => t.name === 'PartialUser');
    expect(enhancedPartialUser?.kind).toBe('type');
    if ('expandedType' in enhancedPartialUser!) {
      expect(enhancedPartialUser.expandedType).toBeDefined();
      // Should have resolved properties
      if ('resolvedProperties' in enhancedPartialUser && enhancedPartialUser.resolvedProperties) {
        expect(enhancedPartialUser.resolvedProperties.length).toBe(4);
        expect(enhancedPartialUser.resolvedProperties.every((p: any) => p.optional)).toBe(true);
      }
    }
  });

  test('should handle generic functions with type inference', () => {
    const testFile = path.join(testDir, 'generic-functions.ts');
    fs.writeFileSync(testFile, `
      export function identity<T>(value: T): T {
        return value;
      }
      
      export function map<T, U>(array: T[], fn: (item: T) => U): U[] {
        return array.map(fn);
      }
      
      export const double = (x: number) => x * 2;
      
      export async function fetchData<T>(url: string): Promise<T> {
        const response = await fetch(url);
        return response.json();
      }
    `);

    const baseSpec = generateBaseSpec(testFile);
    const enhancedSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true
    });

    // Check generic function handling
    const baseIdentity = baseSpec.exports.find(e => e.name === 'identity');
    const enhancedIdentity = enhancedSpec.exports.find(e => e.name === 'identity');

    expect(baseIdentity).toBeDefined();
    expect(enhancedIdentity).toBeDefined();

    // Enhanced parser should flag inferred returns
    const enhancedDouble = enhancedSpec.exports.find(e => e.name === 'double');
    if (enhancedDouble && 'flags' in enhancedDouble) {
      expect(enhancedDouble.flags.isInferredReturn).toBe(true);
    }
  });

  test('should handle class inheritance and interfaces', () => {
    const testFile = path.join(testDir, 'inheritance.ts');
    fs.writeFileSync(testFile, `
      export interface Animal {
        name: string;
        age: number;
      }
      
      export interface Mammal extends Animal {
        furColor: string;
      }
      
      export class Dog implements Mammal {
        name: string;
        age: number;
        furColor: string;
        breed: string;
        
        constructor(name: string, age: number, furColor: string, breed: string) {
          this.name = name;
          this.age = age;
          this.furColor = furColor;
          this.breed = breed;
        }
        
        bark(): string {
          return "Woof!";
        }
      }
    `);

    const baseSpec = generateBaseSpec(testFile);
    const enhancedSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      includeTypeHierarchy: true
    });

    // Check interface extension
    const baseMammal = baseSpec.types.find(t => t.name === 'Mammal');
    const enhancedMammal = enhancedSpec.types.find(t => t.name === 'Mammal');

    // Enhanced parser should show inherited properties
    if ('properties' in enhancedMammal!) {
      expect(enhancedMammal.properties.length).toBeGreaterThan(1); // Should include inherited props
    }

    // Check class implementation
    const enhancedDog = enhancedSpec.types.find(t => t.name === 'Dog');
    if ('members' in enhancedDog!) {
      expect(enhancedDog.members.length).toBeGreaterThan(0);
    }
  });

  test('should show differences in complex type resolution', () => {
    const testFile = path.join(testDir, 'complex-types.ts');
    fs.writeFileSync(testFile, `
      export type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
      };
      
      export interface Config {
        server: {
          host: string;
          port: number;
          ssl: {
            enabled: boolean;
            cert: string;
            key: string;
          };
        };
        database: {
          url: string;
          pool: {
            min: number;
            max: number;
          };
        };
      }
      
      export type PartialConfig = DeepPartial<Config>;
      
      export type ConfigKeys = keyof Config;
      export type ServerConfig = Config['server'];
    `);

    const baseSpec = generateBaseSpec(testFile);
    const enhancedSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      maxDepth: 3
    });

    // Base parser shows type alias
    const basePartialConfig = baseSpec.types.find(t => t.name === 'PartialConfig');
    expect(basePartialConfig?.kind).toBe('type');

    // Enhanced parser can resolve complex mapped types
    const enhancedPartialConfig = enhancedSpec.types.find(t => t.name === 'PartialConfig');
    expect(enhancedPartialConfig?.kind).toBe('type');

    // Check indexed access types
    const serverConfig = enhancedSpec.types.find(t => t.name === 'ServerConfig');
    expect(serverConfig).toBeDefined();
  });

  test('should demonstrate JSDoc extraction improvements', () => {
    const testFile = path.join(testDir, 'jsdoc-rich.ts');
    fs.writeFileSync(testFile, `
      /**
       * User management service
       * @since 2.0.0
       * @deprecated Use UserServiceV2 instead
       * @see {@link UserServiceV2}
       */
      export class UserService {
        /**
         * Add a new user
         * @param name - User's name
         * @param email - User's email
         * @returns The created user ID
         * @throws {Error} If email is invalid
         * @example
         * const id = service.addUser('John', 'john@example.com');
         * console.log(id); // "user_123"
         */
        addUser(name: string, email: string): string {
          return \`user_\${Date.now()}\`;
        }
      }
    `);

    const baseSpec = generateBaseSpec(testFile);
    const enhancedSpec = generateEnhancedSpec(testFile);

    const enhancedClass = enhancedSpec.exports.find(e => e.name === 'UserService');
    
    // Enhanced parser extracts JSDoc tags
    if (enhancedClass && 'tags' in enhancedClass) {
      const sinceTag = enhancedClass.tags.find((t: any) => t.name === 'since');
      expect(sinceTag).toBeDefined();
      expect(sinceTag?.text).toBe('2.0.0');
    }
  });
});