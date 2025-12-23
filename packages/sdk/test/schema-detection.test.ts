/**
 * Tests for schema detection stubs.
 *
 * NOTE: Runtime schema detection was removed for security reasons.
 * Schema extraction now uses static TypeScript Compiler API analysis.
 * See schema-adapters.test.ts for the new static extraction tests.
 */
import { describe, expect, test } from 'bun:test';
import {
  clearSchemaCache,
  detectRuntimeSchemas,
} from '../src/analysis/schema-detection';

describe('detectRuntimeSchemas (stubbed)', () => {
  test('returns empty schemas (runtime detection removed)', async () => {
    const result = await detectRuntimeSchemas({
      baseDir: '/tmp',
      entryFile: '/tmp/index.ts',
    });

    // Runtime detection is stubbed - always returns empty
    expect(result.schemas.size).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('clearSchemaCache is no-op', () => {
    // Should not throw
    expect(() => clearSchemaCache()).not.toThrow();
  });
});

describe('static schema extraction', () => {
  test('see schema-adapters.test.ts for static extraction tests', () => {
    // Static schema extraction (Zod, Valibot, TypeBox, ArkType)
    // is tested in schema-adapters.test.ts
    expect(true).toBe(true);
  });
});
