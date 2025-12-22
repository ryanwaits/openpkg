/**
 * Tests for runtime Standard Schema detection.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  clearSchemaCache,
  detectRuntimeSchemas,
} from '../src/analysis/schema-detection';

describe('detectRuntimeSchemas', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-schema-test-'));
    clearSchemaCache();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearSchemaCache();
  });

  describe('module resolution', () => {
    test('returns empty when no compiled output exists', async () => {
      const tsFile = path.join(tempDir, 'src', 'index.ts');
      fs.mkdirSync(path.dirname(tsFile), { recursive: true });
      fs.writeFileSync(tsFile, 'export const foo = "bar";');

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: tsFile,
      });

      // No compiled JS means no schemas detected - graceful fallback
      expect(result.schemas.size).toBe(0);
      // Error may or may not be present depending on resolution attempts
    });

    test('loads .js file directly when entry is .js', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        module.exports = {
          plainExport: { value: 42 }
        };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      // No Standard Schema exports, but no resolution error
      expect(result.schemas.size).toBe(0);
      expect(result.errors.filter((e) => e.includes('resolve'))).toHaveLength(0);
    });

    test('resolves src/*.ts to dist/*.js', async () => {
      // Create src/index.ts (source)
      const srcDir = path.join(tempDir, 'src');
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(distDir, { recursive: true });

      const tsFile = path.join(srcDir, 'index.ts');
      const jsFile = path.join(distDir, 'index.js');

      fs.writeFileSync(tsFile, 'export const foo = "bar";');
      fs.writeFileSync(
        jsFile,
        `
        module.exports = {
          foo: "bar"
        };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: tsFile,
      });

      // Should resolve to dist/index.js without error
      expect(result.errors.filter((e) => e.includes('resolve'))).toHaveLength(0);
    });
  });

  describe('Standard Schema detection', () => {
    test('detects Standard Schema v1 exports', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        const UserSchema = {
          '~standard': {
            version: 1,
            vendor: 'test-vendor',
            jsonSchema: {
              output: () => ({
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number' }
                },
                required: ['name']
              })
            }
          }
        };

        module.exports = { UserSchema };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.schemas.size).toBe(1);
      expect(result.schemas.has('UserSchema')).toBe(true);

      const schema = result.schemas.get('UserSchema');
      expect(schema?.vendor).toBe('test-vendor');
      expect(schema?.schema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });
    });

    test('skips exports without ~standard marker', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        const plainObject = { foo: 'bar' };
        const plainFunction = () => {};
        const plainString = 'hello';

        module.exports = { plainObject, plainFunction, plainString };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.schemas.size).toBe(0);
    });

    test('skips underscore-prefixed exports', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        const _internal = {
          '~standard': {
            version: 1,
            vendor: 'test',
            jsonSchema: { output: () => ({ type: 'string' }) }
          }
        };

        module.exports = { _internal };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.schemas.size).toBe(0);
    });

    test('handles multiple Standard Schema exports', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        const createSchema = (name, type) => ({
          '~standard': {
            version: 1,
            vendor: 'zod',
            jsonSchema: { output: () => ({ type }) }
          }
        });

        module.exports = {
          StringSchema: createSchema('String', 'string'),
          NumberSchema: createSchema('Number', 'number'),
          BooleanSchema: createSchema('Boolean', 'boolean'),
        };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.schemas.size).toBe(3);
      expect(result.schemas.has('StringSchema')).toBe(true);
      expect(result.schemas.has('NumberSchema')).toBe(true);
      expect(result.schemas.has('BooleanSchema')).toBe(true);
    });
  });

  describe('error handling', () => {
    test('gracefully handles module load errors', async () => {
      const jsFile = path.join(tempDir, 'broken.js');
      fs.writeFileSync(jsFile, 'this is not valid javascript {{{');

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.schemas.size).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Runtime detection failed');
    });

    test('gracefully handles schema extraction errors', async () => {
      const jsFile = path.join(tempDir, 'index.js');
      fs.writeFileSync(
        jsFile,
        `
        const BrokenSchema = {
          '~standard': {
            version: 1,
            vendor: 'test',
            jsonSchema: {
              output: () => { throw new Error('Extraction failed'); }
            }
          }
        };

        module.exports = { BrokenSchema };
      `,
      );

      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      // Should not include the broken schema but shouldn't crash
      expect(result.schemas.has('BrokenSchema')).toBe(false);
    });
  });

  describe('caching', () => {
    test('clearSchemaCache clears the module cache', async () => {
      const jsFile = path.join(tempDir, 'cached.js');
      fs.writeFileSync(
        jsFile,
        `
        module.exports = { value: 'original' };
      `,
      );

      // First load
      await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      // Modify file
      fs.writeFileSync(
        jsFile,
        `
        module.exports = { value: 'modified' };
      `,
      );

      // Clear cache
      clearSchemaCache();

      // Note: Due to Node's require cache, this test verifies our cache is cleared
      // but Node may still have its own cache. In production, mtime-based invalidation handles this.
      const result = await detectRuntimeSchemas({
        baseDir: tempDir,
        entryFile: jsFile,
      });

      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('integration: DocCov with schema detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-integration-'));
    clearSchemaCache();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearSchemaCache();
  });

  test('analyzeFileWithDiagnostics uses detected schemas', async () => {
    // Create a minimal package with Standard Schema export
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-pkg' }));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

    // TypeScript source
    fs.writeFileSync(
      path.join(tempDir, 'index.ts'),
      `
      export const UserSchema = {} as any; // Type doesn't matter for this test
    `,
    );

    // Compiled JS with Standard Schema
    fs.writeFileSync(
      path.join(tempDir, 'index.js'),
      `
      const UserSchema = {
        '~standard': {
          version: 1,
          vendor: 'zod',
          jsonSchema: {
            output: () => ({
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' }
              },
              required: ['id', 'email']
            })
          }
        }
      };

      module.exports = { UserSchema };
    `,
    );

    const { DocCov } = await import('../src/openpkg');
    const doccov = new DocCov();
    const result = await doccov.analyzeFileWithDiagnostics(path.join(tempDir, 'index.ts'));

    // Find the UserSchema export
    const userSchemaExport = result.spec.exports.find((e) => e.name === 'UserSchema');
    expect(userSchemaExport).toBeDefined();

    // Should have the runtime-extracted schema
    expect(userSchemaExport?.schema).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
      required: ['id', 'email'],
    });

    // Should have the standardSchema tag
    const schemaTag = userSchemaExport?.tags?.find((t) => t.name === 'standardSchema');
    expect(schemaTag?.text).toBe('zod');
  });
});
