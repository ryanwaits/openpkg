/**
 * Tests for spec diffing and breaking change detection.
 */
import { describe, expect, test } from 'bun:test';
import { categorizeBreakingChanges, diffSpec } from '@openpkg-ts/spec';
import { createDrift, createEnrichedSpec, createExport, createSpec } from './test-helpers';

describe('diffSpec', () => {
  describe('structural changes', () => {
    test('detects removed exports as breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' }), createExport({ name: 'bar' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toContain('bar');
      expect(diff.breaking).toHaveLength(1);
    });

    test('detects new exports as non-breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' }), createExport({ name: 'bar' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.nonBreaking).toContain('bar');
      expect(diff.breaking).toHaveLength(0);
    });

    test('detects signature changes as breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', signature: 'function foo(): void' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', signature: 'function foo(x: number): void' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toContain('foo');
    });

    test('empty specs produce no changes', () => {
      const oldSpec = createEnrichedSpec({ exports: [] });
      const newSpec = createEnrichedSpec({ exports: [] });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toHaveLength(0);
      expect(diff.nonBreaking).toHaveLength(0);
      expect(diff.docsOnly).toHaveLength(0);
    });

    test('identical specs produce no changes', () => {
      const exp = createExport({ name: 'foo', signature: 'function foo(): void' });
      const oldSpec = createEnrichedSpec({ exports: [exp] });
      const newSpec = createEnrichedSpec({ exports: [{ ...exp }] });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toHaveLength(0);
      expect(diff.nonBreaking).toHaveLength(0);
      expect(diff.docsOnly).toHaveLength(0);
    });
  });

  describe('docs-only changes', () => {
    test('description changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', description: 'Old description' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', description: 'New description' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });

    test('example changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', examples: ['old example'] })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', examples: ['new example'] })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });

    test('source location changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', source: { file: 'old.ts', line: 1 } })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', source: { file: 'new.ts', line: 10 } })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });
  });

  describe('coverage tracking', () => {
    test('calculates coverage delta', () => {
      const oldSpec = createEnrichedSpec({ coverageScore: 50 });
      const newSpec = createEnrichedSpec({ coverageScore: 75 });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.oldCoverage).toBe(50);
      expect(diff.newCoverage).toBe(75);
      expect(diff.coverageDelta).toBe(25);
    });

    test('handles negative coverage delta', () => {
      const oldSpec = createEnrichedSpec({ coverageScore: 80 });
      const newSpec = createEnrichedSpec({ coverageScore: 60 });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.coverageDelta).toBe(-20);
    });

    test('handles specs without coverage metadata', () => {
      const oldSpec = createSpec({ exports: [] });
      const newSpec = createSpec({ exports: [] });

      const diff = diffSpec(oldSpec as any, newSpec as any);

      expect(diff.oldCoverage).toBe(0);
      expect(diff.newCoverage).toBe(0);
      expect(diff.coverageDelta).toBe(0);
    });

    test('tracks newly undocumented exports', () => {
      const oldSpec = createEnrichedSpec({ exports: [] });
      const newSpec = createEnrichedSpec({
        coverageScore: 50,
        exports: [
          {
            ...createExport({ name: 'foo' }),
            docs: { coverageScore: 50, missing: ['has-description'] },
          } as any,
        ],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.newUndocumented).toContain('foo');
    });
  });

  describe('drift tracking', () => {
    test('tracks introduced drift', () => {
      const oldSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 100 } } as any],
      });
      const newSpec = createEnrichedSpec({
        exports: [
          {
            ...createExport({ name: 'foo' }),
            docs: { coverageScore: 100, drift: [createDrift()] },
          } as any,
        ],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.driftIntroduced).toBe(1);
    });

    test('tracks resolved drift', () => {
      const oldSpec = createEnrichedSpec({
        exports: [
          {
            ...createExport({ name: 'foo' }),
            docs: { coverageScore: 100, drift: [createDrift(), createDrift()] },
          } as any,
        ],
      });
      const newSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 100 } } as any],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.driftResolved).toBe(2);
    });
  });

  describe('improved/regressed exports', () => {
    test('tracks improved coverage per export', () => {
      const oldSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 50 } } as any],
      });
      const newSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 100 } } as any],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.improvedExports).toContain('foo');
    });

    test('tracks regressed coverage per export', () => {
      const oldSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 100 } } as any],
      });
      const newSpec = createEnrichedSpec({
        exports: [{ ...createExport({ name: 'foo' }), docs: { coverageScore: 50 } } as any],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.regressedExports).toContain('foo');
    });
  });
});

describe('categorizeBreakingChanges', () => {
  test('categorizes removed function as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'foo', kind: 'function' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['foo'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('removed');
  });

  test('categorizes removed class as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
  });

  test('categorizes removed interface as medium severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'Options', kind: 'interface' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['Options'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('medium');
  });

  test('categorizes function signature change as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'foo', kind: 'function', signature: 'function foo(): void' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'foo', kind: 'function', signature: 'function foo(x: number): void' }),
      ],
    });

    const categorized = categorizeBreakingChanges(['foo'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('signature changed');
  });

  test('categorizes type definition change as medium severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'Config', kind: 'type' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'Config', kind: 'type', signature: 'type Config = { new: true }' }),
      ],
    });

    const categorized = categorizeBreakingChanges(['Config'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('medium');
    expect(categorized[0].reason).toBe('type definition changed');
  });

  test('sorts results by severity (high first)', () => {
    const oldSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'fn', kind: 'function' }),
        createExport({ name: 'Type', kind: 'type' }),
        createExport({ name: 'VAR', kind: 'variable' }),
      ],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['Type', 'VAR', 'fn'], oldSpec, newSpec);

    expect(categorized[0].name).toBe('fn'); // high
    expect(categorized[1].name).toBe('Type'); // medium
    expect(categorized[2].name).toBe('VAR'); // medium (or low)
  });

  test('handles class with constructor changes as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });

    const memberChanges = [
      {
        className: 'MyClass',
        memberName: 'constructor',
        memberKind: 'constructor' as const,
        changeType: 'signature-changed' as const,
      },
    ];

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('constructor changed');
  });

  test('handles class with removed method as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });

    const memberChanges = [
      {
        className: 'MyClass',
        memberName: 'doSomething',
        memberKind: 'method' as const,
        changeType: 'removed' as const,
      },
    ];

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('methods removed');
  });
});
