import { describe, expect, it } from 'bun:test';
import { applyFilters } from '../src/filtering/apply-filters';
import type { OpenPkgSpec } from '../src/types/openpkg';

const createSpec = (): OpenPkgSpec => ({
  openpkg: '0.1.0',
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
      result.diagnostics.some((diag) => diag.message.includes('Excluded types are still referenced')),
    ).toBe(true);
  });
});
