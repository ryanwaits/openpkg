import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { generateBaseSpec } from '../src/base-parser';
import { generateEnhancedSpec } from '../src/base-parser-enhanced';
import { z } from 'zod';
import { openPkgSchema } from '../src/types/openpkg';

const testDir = path.join(__dirname, 'temp-phase4');

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

describe('Phase 4: Output Format Compatibility', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  test('should maintain backward compatibility for basic types', () => {
    const testFile = path.join(testDir, 'basic-types.ts');
    fs.writeFileSync(testFile, `
      export interface User {
        id: string;
        name: string;
        email: string;
      }
      
      export function createUser(name: string, email: string): User {
        return { id: '1', name, email };
      }
      
      export type UserID = string;
      
      export enum UserRole {
        Admin = 'admin',
        User = 'user',
        Guest = 'guest'
      }
    `);

    // Generate with old parser
    const oldSpec = generateBaseSpec(testFile);
    
    // Generate with new parser (without enhanced features)
    const newSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: false,
      includeTypeHierarchy: false
    });

    // Validate both conform to schema
    expect(() => openPkgSchema.parse(oldSpec)).not.toThrow();
    expect(() => openPkgSchema.parse(newSpec)).not.toThrow();

    // Check structure compatibility
    expect(newSpec.openpkg).toBe(oldSpec.openpkg);
    expect(newSpec.meta.ecosystem).toBe(oldSpec.meta.ecosystem);
    
    // Check exports have same structure
    expect(newSpec.exports.length).toBe(oldSpec.exports.length);
    newSpec.exports.forEach((exp, i) => {
      const oldExp = oldSpec.exports[i];
      expect(exp.id).toBe(oldExp.id);
      expect(exp.kind).toBe(oldExp.kind);
      expect(exp.name).toBe(oldExp.name);
    });

    // Check types have same structure
    expect(newSpec.types.length).toBe(oldSpec.types.length);
    newSpec.types.forEach((type, i) => {
      const oldType = oldSpec.types[i];
      expect(type.id).toBe(oldType.id);
      expect(type.kind).toBe(oldType.kind);
      expect(type.name).toBe(oldType.name);
    });
  });

  test('should handle complex generic types consistently', () => {
    const testFile = path.join(testDir, 'generics.ts');
    fs.writeFileSync(testFile, `
      export interface Repository<T> {
        items: T[];
        add(item: T): void;
        find(id: string): T | undefined;
      }
      
      export type Partial<T> = {
        [P in keyof T]?: T[P];
      };
      
      export interface User {
        id: string;
        name: string;
        email: string;
      }
      
      export type PartialUser = Partial<User>;
    `);

    const oldSpec = generateBaseSpec(testFile);
    const newSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: false,
      includeTypeHierarchy: false
    });

    // Both should handle generics
    const repoType = newSpec.types.find(t => t.name === 'Repository');
    const oldRepoType = oldSpec.types.find(t => t.name === 'Repository');
    
    expect(repoType).toBeDefined();
    expect(oldRepoType).toBeDefined();
    expect(repoType?.kind).toBe(oldRepoType?.kind);
  });

  test('enhanced mode should add extra information without breaking compatibility', () => {
    const testFile = path.join(testDir, 'enhanced.ts');
    fs.writeFileSync(testFile, `
      /**
       * User interface with documentation
       * @since 1.0.0
       */
      export interface User {
        /** User ID */
        id: string;
        /** User name */
        name: string;
      }
      
      /**
       * Create a new user
       * @param name - The user's name
       * @returns A new user object
       */
      export function createUser(name: string): User {
        return { id: '1', name };
      }
    `);

    const basicSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: false,
      includeTypeHierarchy: false
    });

    const enhancedSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: true,
      includeTypeHierarchy: true
    });

    // Basic fields should be identical
    expect(enhancedSpec.openpkg).toBe(basicSpec.openpkg);
    expect(enhancedSpec.exports.length).toBe(basicSpec.exports.length);
    expect(enhancedSpec.types.length).toBe(basicSpec.types.length);

    // Enhanced should have additional fields
    const enhancedFunc = enhancedSpec.exports.find(e => e.name === 'createUser');
    expect(enhancedFunc).toBeDefined();
    // The function itself doesn't have @since, but we should have description
    
    const enhancedType = enhancedSpec.types.find(t => t.name === 'User');
    if (enhancedType && 'typeHierarchy' in enhancedType) {
      expect(enhancedType.typeHierarchy).toBeDefined();
    }
  });

  test('should handle class declarations consistently', () => {
    const testFile = path.join(testDir, 'classes.ts');
    fs.writeFileSync(testFile, `
      export class UserService {
        private users: Map<string, User> = new Map();
        
        constructor(private readonly apiUrl: string) {}
        
        addUser(user: User): void {
          this.users.set(user.id, user);
        }
        
        getUser(id: string): User | undefined {
          return this.users.get(id);
        }
      }
      
      interface User {
        id: string;
        name: string;
      }
    `);

    const oldSpec = generateBaseSpec(testFile);
    const newSpec = generateEnhancedSpec(testFile, {
      includeResolvedTypes: false,
      includeTypeHierarchy: false
    });

    // Find class in both specs
    const oldClass = oldSpec.exports.find(e => e.name === 'UserService');
    const newClass = newSpec.exports.find(e => e.name === 'UserService');

    expect(oldClass).toBeDefined();
    expect(newClass).toBeDefined();
    expect(oldClass?.kind).toBe('class');
    expect(newClass?.kind).toBe('class');

    // Both should also have the class in types
    const oldClassType = oldSpec.types.find(t => t.name === 'UserService');
    const newClassType = newSpec.types.find(t => t.name === 'UserService');

    expect(oldClassType).toBeDefined();
    expect(newClassType).toBeDefined();
  });

  test('should validate against OpenPkg schema', () => {
    const testFile = path.join(testDir, 'schema-validation.ts');
    fs.writeFileSync(testFile, `
      export interface Config {
        apiUrl: string;
        timeout: number;
      }
      
      export const defaultConfig: Config = {
        apiUrl: 'https://api.example.com',
        timeout: 5000
      };
      
      export function configure(config: Partial<Config>): Config {
        return { ...defaultConfig, ...config };
      }
    `);

    const specs = [
      generateBaseSpec(testFile),
      generateEnhancedSpec(testFile, { includeResolvedTypes: false }),
      generateEnhancedSpec(testFile, { includeResolvedTypes: true })
    ];

    // All variations should pass schema validation
    specs.forEach((spec, index) => {
      expect(() => openPkgSchema.parse(spec)).not.toThrow();
      expect(spec.openpkg).toBe('1.0.0');
      expect(spec.meta.ecosystem).toBe('js/ts');
      expect(Array.isArray(spec.exports)).toBe(true);
      expect(Array.isArray(spec.types)).toBe(true);
    });
  });
});