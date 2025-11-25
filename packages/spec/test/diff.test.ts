import { describe, expect, it } from 'bun:test';
import { diffSpec } from '../src/diff';
import type { OpenPkg } from '../src/types';

function createSpec(overrides: Partial<OpenPkg> = {}): OpenPkg {
  return {
    openpkg: '0.2.0',
    meta: { name: 'test-package' },
    exports: [],
    types: [],
    docs: { coverageScore: 100 },
    ...overrides,
  };
}

describe('diffSpec structural changes', () => {
  it('detects breaking changes when exports are removed', () => {
    const oldSpec = createSpec({
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', signatures: [] },
        { id: 'bar', name: 'bar', kind: 'function', signatures: [] },
      ],
    });
    const newSpec = createSpec({
      exports: [{ id: 'foo', name: 'foo', kind: 'function', signatures: [] }],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.breaking).toContain('bar');
    expect(diff.breaking).toHaveLength(1);
  });

  it('detects non-breaking changes when exports are added', () => {
    const oldSpec = createSpec({
      exports: [{ id: 'foo', name: 'foo', kind: 'function', signatures: [] }],
    });
    const newSpec = createSpec({
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', signatures: [] },
        { id: 'bar', name: 'bar', kind: 'function', signatures: [] },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.nonBreaking).toContain('bar');
    expect(diff.nonBreaking).toHaveLength(1);
    expect(diff.breaking).toHaveLength(0);
  });

  it('detects docs-only changes when only description changes', () => {
    const oldSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          description: 'Old description',
        },
      ],
    });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          description: 'New description',
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.docsOnly).toContain('foo');
    expect(diff.breaking).toHaveLength(0);
    expect(diff.nonBreaking).toHaveLength(0);
  });
});

describe('diffSpec coverage delta', () => {
  it('calculates positive coverage delta', () => {
    const oldSpec = createSpec({ docs: { coverageScore: 60 } });
    const newSpec = createSpec({ docs: { coverageScore: 85 } });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.oldCoverage).toBe(60);
    expect(diff.newCoverage).toBe(85);
    expect(diff.coverageDelta).toBe(25);
  });

  it('calculates negative coverage delta', () => {
    const oldSpec = createSpec({ docs: { coverageScore: 90 } });
    const newSpec = createSpec({ docs: { coverageScore: 75 } });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.oldCoverage).toBe(90);
    expect(diff.newCoverage).toBe(75);
    expect(diff.coverageDelta).toBe(-15);
  });

  it('handles missing coverage scores', () => {
    const oldSpec = createSpec({ docs: undefined });
    const newSpec = createSpec({ docs: { coverageScore: 50 } });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.oldCoverage).toBe(0);
    expect(diff.newCoverage).toBe(50);
    expect(diff.coverageDelta).toBe(50);
  });
});

describe('diffSpec undocumented exports', () => {
  it('tracks new undocumented exports', () => {
    const oldSpec = createSpec({
      exports: [{ id: 'foo', name: 'foo', kind: 'function', signatures: [] }],
    });
    const newSpec = createSpec({
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', signatures: [] },
        {
          id: 'bar',
          name: 'bar',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 50, missing: ['description'] },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.newUndocumented).toContain('bar');
  });

  it('does not flag new fully-documented exports', () => {
    const oldSpec = createSpec({ exports: [] });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 100 },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.newUndocumented).toHaveLength(0);
  });
});

describe('diffSpec export coverage changes', () => {
  it('tracks improved exports', () => {
    const oldSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 50 },
        },
      ],
    });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 100 },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.improvedExports).toContain('foo');
    expect(diff.regressedExports).toHaveLength(0);
  });

  it('tracks regressed exports', () => {
    const oldSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 100 },
        },
      ],
    });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 75 },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.regressedExports).toContain('foo');
    expect(diff.improvedExports).toHaveLength(0);
  });
});

describe('diffSpec drift tracking', () => {
  it('counts new drift introduced', () => {
    const oldSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 100 },
        },
      ],
    });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: {
            coverageScore: 100,
            drift: [
              { type: 'param-mismatch', target: 'x', issue: 'Param x not found' },
              { type: 'return-type-mismatch', target: 'returns', issue: 'Wrong type' },
            ],
          },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.driftIntroduced).toBe(2);
    expect(diff.driftResolved).toBe(0);
  });

  it('counts drift resolved', () => {
    const oldSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: {
            coverageScore: 100,
            drift: [
              { type: 'param-mismatch', target: 'x', issue: 'Param x not found' },
              { type: 'return-type-mismatch', target: 'returns', issue: 'Wrong type' },
            ],
          },
        },
      ],
    });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 100 },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.driftResolved).toBe(2);
    expect(diff.driftIntroduced).toBe(0);
  });

  it('tracks drift on new exports', () => {
    const oldSpec = createSpec({ exports: [] });
    const newSpec = createSpec({
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          signatures: [],
          docs: {
            coverageScore: 100,
            drift: [{ type: 'param-mismatch', target: 'x', issue: 'Param x not found' }],
          },
        },
      ],
    });

    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.driftIntroduced).toBe(1);
  });
});

