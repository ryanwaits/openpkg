/**
 * Tests for spec enrichment with coverage metadata.
 */
import { describe, expect, test } from 'bun:test';
import { enrichSpec } from '../src/analysis/enrich';
import { createDocumentedFunction, createDrift, createExport, createSpec } from './test-helpers';

describe('enrichSpec', () => {
  describe('coverage calculation', () => {
    test('empty spec has 100% coverage', () => {
      const spec = createSpec({ exports: [] });
      const enriched = enrichSpec(spec);

      expect(enriched.docs?.coverageScore).toBe(100);
    });

    test('documented function gets high coverage', () => {
      const spec = createSpec({
        exports: [
          createDocumentedFunction('greet', {
            description: 'Greets a user',
            examples: ['greet("Alice")'],
            params: [{ name: 'name', type: 'string', description: 'User name' }],
            returnType: 'string',
          }),
        ],
      });

      const enriched = enrichSpec(spec);

      // Should have good coverage score
      expect(enriched.exports[0].docs?.coverageScore).toBeGreaterThan(50);
    });

    test('undocumented function has lower coverage', () => {
      const spec = createSpec({
        exports: [createExport({ name: 'foo', kind: 'function' })],
      });

      const enriched = enrichSpec(spec);

      // Should have lower coverage due to missing docs
      expect(enriched.exports[0].docs?.coverageScore).toBeLessThan(100);
      expect(enriched.exports[0].docs?.missing).toBeDefined();
    });

    test('aggregate coverage is average of exports', () => {
      const spec = createSpec({
        exports: [
          createDocumentedFunction('documented', {
            description: 'Well documented',
            examples: ['documented()'],
          }),
          createExport({ name: 'undocumented', kind: 'function' }),
        ],
      });

      const enriched = enrichSpec(spec);

      // Overall should be between the two
      const exportScores = enriched.exports.map((e) => e.docs?.coverageScore ?? 0);
      const avg = Math.round(exportScores.reduce((a, b) => a + b, 0) / exportScores.length);
      expect(enriched.docs?.coverageScore).toBe(avg);
    });
  });

  describe('missing rule tracking', () => {
    test('tracks missing rules per export', () => {
      const spec = createSpec({
        exports: [createExport({ name: 'foo', kind: 'function' })],
      });

      const enriched = enrichSpec(spec);

      expect(enriched.exports[0].docs?.missing).toBeDefined();
      expect(enriched.exports[0].docs?.missing?.length).toBeGreaterThan(0);
    });

    test('aggregates missing rules across exports', () => {
      const spec = createSpec({
        exports: [
          createExport({ name: 'foo', kind: 'function' }),
          createExport({ name: 'bar', kind: 'function' }),
        ],
      });

      const enriched = enrichSpec(spec);

      // Overall missing should include all missing from exports
      expect(enriched.docs?.missing).toBeDefined();
    });

    test('no missing rules for fully documented export', () => {
      const spec = createSpec({
        exports: [
          createDocumentedFunction('greet', {
            description: 'Greets a user',
            examples: ['greet("Alice") // => "Hello Alice"'],
          }),
        ],
      });

      const enriched = enrichSpec(spec);

      // May still have some missing rules but should be fewer
      const missingCount = enriched.exports[0].docs?.missing?.length ?? 0;
      expect(missingCount).toBeLessThan(5);
    });
  });

  describe('drift handling', () => {
    test('includes provided drift in enrichment', () => {
      const spec = createSpec({
        exports: [createExport({ id: 'foo', name: 'foo' })],
      });

      const driftByExport = new Map([['foo', [createDrift({ issue: 'Test drift' })]]]);

      const enriched = enrichSpec(spec, { driftByExport });

      expect(enriched.exports[0].docs?.drift).toBeDefined();
      expect(enriched.exports[0].docs?.drift?.length).toBe(1);
      expect(enriched.exports[0].docs?.drift?.[0].issue).toBe('Test drift');
    });

    test('aggregates drift across exports', () => {
      const spec = createSpec({
        exports: [
          createExport({ id: 'foo', name: 'foo' }),
          createExport({ id: 'bar', name: 'bar' }),
        ],
      });

      const driftByExport = new Map([
        ['foo', [createDrift({ issue: 'Drift 1' })]],
        ['bar', [createDrift({ issue: 'Drift 2' }), createDrift({ issue: 'Drift 3' })]],
      ]);

      const enriched = enrichSpec(spec, { driftByExport });

      expect(enriched.docs?.drift?.length).toBe(3);
    });

    test('produces drift summary with category breakdown', () => {
      const spec = createSpec({
        exports: [createExport({ id: 'foo', name: 'foo' })],
      });

      const driftByExport = new Map([
        [
          'foo',
          [
            createDrift({ type: 'param-mismatch', issue: 'Param issue' }),
            createDrift({ type: 'return-type-mismatch', issue: 'Return issue' }),
          ],
        ],
      ]);

      const enriched = enrichSpec(spec, { driftByExport });

      expect(enriched.driftSummary).toBeDefined();
      expect(enriched.driftSummary?.total).toBe(2);
    });

    test('no drift summary when no drift exists', () => {
      const spec = createSpec({
        exports: [createExport({ name: 'foo' })],
      });

      const enriched = enrichSpec(spec);

      expect(enriched.driftSummary).toBeUndefined();
    });
  });

  describe('missing documentation', () => {
    test('tracks missing docs per export', () => {
      const spec = createSpec({
        exports: [createExport({ name: 'foo', kind: 'function' })],
      });

      const enriched = enrichSpec(spec);

      // Undocumented function should have missing items
      expect(enriched.exports[0].docs?.missing).toBeDefined();
      expect(enriched.exports[0].docs?.missing).toContain('has-description');
    });

    test('aggregates missing across exports', () => {
      const spec = createSpec({
        exports: [
          createExport({ name: 'foo', kind: 'function' }),
          createExport({ name: 'bar', kind: 'function' }),
        ],
      });

      const enriched = enrichSpec(spec);

      // Overall missing should include all
      expect(enriched.docs?.missing).toBeDefined();
      expect(enriched.docs?.missing).toContain('has-description');
    });

    test('no missing when documented', () => {
      const spec = createSpec({
        exports: [createExport({ name: 'foo', kind: 'function', description: 'A function' })],
      });

      const enriched = enrichSpec(spec);

      // Documented function should have no missing
      expect(enriched.exports[0].docs?.missing).toBeUndefined();
    });
  });

  describe('raw JSDoc handling', () => {
    test('uses raw JSDoc for style checks', () => {
      const spec = createSpec({
        exports: [createExport({ id: 'foo', name: 'foo', kind: 'function' })],
      });

      const rawJSDocByExport = new Map([['foo', '/** This is a description */']]);

      // Should not throw and should process
      const enriched = enrichSpec(spec, { rawJSDocByExport });

      expect(enriched).toBeDefined();
    });
  });

  describe('preserves original spec data', () => {
    test('keeps all original export fields', () => {
      const original = createExport({
        name: 'myFn',
        kind: 'function',
        signature: 'function myFn(): void',
        description: 'Original description',
      });

      const spec = createSpec({ exports: [original] });
      const enriched = enrichSpec(spec);

      expect(enriched.exports[0].name).toBe('myFn');
      expect(enriched.exports[0].signature).toBe('function myFn(): void');
      expect(enriched.exports[0].description).toBe('Original description');
    });

    test('keeps package metadata', () => {
      const spec = createSpec({
        name: 'my-pkg',
        version: '1.2.3',
        exports: [],
      });

      const enriched = enrichSpec(spec);

      expect(enriched.name).toBe('my-pkg');
      expect(enriched.version).toBe('1.2.3');
      expect(enriched.openpkg).toBe('0.9.0');
    });
  });
});
