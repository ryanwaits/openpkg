import { describe, expect, it } from 'bun:test';
import type { OpenPkgSpec } from '../src/analysis/spec-types';
import { applyFilters } from '../src/filtering/apply-filters';

const createSpec = (): OpenPkgSpec => ({
  openpkg: '0.2.0',
  meta: {
    name: 'fixture',
    version: '1.0.0',
    description: '',
    license: '',
    repository: '',
    ecosystem: 'js/ts',
  },
  exports: [
    {
      id: 'alpha',
      name: 'alpha',
      kind: 'function',
      signatures: [
        {
          parameters: [
            {
              name: 'input',
              required: true,
              schema: { $ref: '#/types/Foo' },
            },
          ],
          returns: {
            schema: { type: 'string' },
          },
        },
      ],
    },
    {
      id: 'beta',
      name: 'beta',
      kind: 'function',
      signatures: [
        {
          parameters: [],
          returns: {
            schema: { type: 'number' },
          },
        },
      ],
    },
  ],
  types: [
    {
      id: 'Foo',
      name: 'Foo',
      kind: 'interface',
      schema: {
        type: 'object',
        properties: {
          nested: { $ref: '#/types/Bar' },
        },
      },
    },
    {
      id: 'Bar',
      name: 'Bar',
      kind: 'interface',
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      },
    },
  ],
});

describe('applyFilters', () => {
  it('retains exports and dependent types when included explicitly', () => {
    const spec = createSpec();

    const result = applyFilters(spec, { include: ['alpha'] });

    expect(result.changed).toBe(true);
    expect(result.spec.exports?.map((entry) => entry.id)).toEqual(['alpha']);
    expect(result.spec.types?.map((entry) => entry.id)).toEqual(['Foo', 'Bar']);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('reports diagnostics when includes do not match', () => {
    const spec = createSpec();

    const result = applyFilters(spec, { include: ['missing'] });

    expect(result.spec.exports?.length ?? 0).toBe(0);
    expect(result.spec.types?.length ?? 0).toBe(0);
    expect(result.diagnostics.some((diag) => diag.message.includes('no matches'))).toBe(true);
  });

  it('warns when excluded types are still referenced', () => {
    const spec = createSpec();

    const result = applyFilters(spec, { exclude: ['Foo'] });

    expect(result.spec.exports?.map((entry) => entry.id)).toEqual(['alpha', 'beta']);
    expect(result.spec.types).toEqual([]);
    expect(
      result.diagnostics.some((diag) =>
        diag.message.includes('Excluded types are still referenced'),
      ),
    ).toBe(true);
  });

  describe('docs coverage', () => {
    const createSpecWithDocs = (): OpenPkgSpec => ({
      openpkg: '0.2.0',
      meta: {
        name: 'fixture',
        version: '1.0.0',
        description: '',
        license: '',
        repository: '',
        ecosystem: 'js/ts',
      },
      exports: [
        {
          id: 'doc100',
          name: 'doc100',
          kind: 'function',
          description: 'Has description',
          signatures: [
            {
              parameters: [],
              returns: { description: 'Returns something', schema: { type: 'void' } },
            },
          ],
          examples: ['example'],
          docs: { coverageScore: 100 },
        },
        {
          id: 'doc50',
          name: 'doc50',
          kind: 'function',
          signatures: [],
          docs: { coverageScore: 50 },
        },
      ],
      types: [],
      docs: { coverageScore: 999 },
    });

    it('recomputes docs coverage when filtering exports', () => {
      const spec = createSpecWithDocs();
      const result = applyFilters(spec, { include: ['doc100'] });

      expect(result.spec.exports?.map((entry) => entry.id)).toEqual(['doc100']);
      expect(result.spec.docs?.coverageScore).toBe(100);
    });

    it('recomputes docs coverage when filtering to partially documented export', () => {
      const spec = createSpecWithDocs();
      const result = applyFilters(spec, { include: ['doc50'] });

      expect(result.spec.exports?.map((entry) => entry.id)).toEqual(['doc50']);
      expect(result.spec.docs?.coverageScore).toBe(50);
    });
  });
});
