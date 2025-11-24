import { describe, expect, it } from 'bun:test';
import { computeDocsCoverage } from '../src/analysis/docs-coverage';
import type { OpenPkgSpec } from '../src/analysis/spec-types';

function buildSpec(exportOverride: Partial<OpenPkgSpec['exports'][number]>): OpenPkgSpec {
  const baseExport: OpenPkgSpec['exports'][number] = {
    id: 'example',
    name: 'example',
    kind: 'function',
    signatures: [
      {
        parameters: [
          {
            name: 'amount',
            required: true,
            schema: { type: 'number' },
          },
        ],
      },
    ],
  };

  const mergedExport = { ...baseExport, ...exportOverride };

  return {
    openpkg: '0.2.0',
    meta: { name: 'fixture' },
    exports: [mergedExport],
  };
}

describe('docs coverage param type drift detection', () => {
  it('reports drift when @param type contradicts the signature', () => {
    const spec = buildSpec({
      id: 'drift',
      name: 'drift',
      tags: [{ name: 'param', text: '{string} amount - Base amount (incorrect on purpose)' }],
    });

    const result = computeDocsCoverage(spec);
    const exportMeta = result.exports.get('drift');
    expect(exportMeta?.drift).toBeDefined();
    expect(exportMeta?.drift).toHaveLength(1);
    expect(exportMeta?.drift?.[0]).toMatchObject({
      type: 'param-type-mismatch',
      target: 'amount',
    });
    expect(exportMeta?.drift?.[0].issue).toContain('string');
  });

  it('does not report drift when @param type matches the signature', () => {
    const spec = buildSpec({
      id: 'aligned',
      name: 'aligned',
      tags: [{ name: 'param', text: '{number} amount - Base amount' }],
    });

    const result = computeDocsCoverage(spec);
    const exportMeta = result.exports.get('aligned');
    expect(exportMeta?.drift).toBeUndefined();
  });
});

describe('docs coverage generic constraint drift detection', () => {
  it('reports drift when @template omits a constraint present in the signature', () => {
    const spec = buildSpec({
      id: 'generic-missing',
      name: 'generic-missing',
      signatures: [
        {
          typeParameters: [{ name: 'T', constraint: 'Record<string, unknown>' }],
          parameters: [],
        },
      ],
      tags: [{ name: 'template', text: 'T - template without constraint' }],
    });

    const result = computeDocsCoverage(spec);
    const exportMeta = result.exports.get('generic-missing');
    expect(exportMeta?.drift).toBeDefined();
    expect(exportMeta?.drift?.[0]).toMatchObject({
      type: 'generic-constraint-mismatch',
      target: 'T',
    });
    expect(exportMeta?.drift?.[0].issue).toContain('Record<string, unknown>');
  });

  it('does not report drift when @template matches the declared constraint', () => {
    const spec = buildSpec({
      id: 'generic-aligned',
      name: 'generic-aligned',
      signatures: [
        {
          typeParameters: [{ name: 'T', constraint: 'Record<string, unknown>' }],
          parameters: [],
        },
      ],
      tags: [{ name: 'template', text: '{Record<string, unknown>} T - docs aligned' }],
    });

    const result = computeDocsCoverage(spec);
    const exportMeta = result.exports.get('generic-aligned');
    expect(exportMeta?.drift).toBeUndefined();
  });
});

describe('docs coverage visibility drift detection', () => {
  it('reports drift when an exported symbol is tagged @internal', () => {
    const spec = buildSpec({
      id: 'internal-export',
      name: 'internal-export',
      tags: [{ name: 'internal', text: '' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('internal-export')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'visibility-mismatch',
      target: 'internal-export',
    });
    expect(drift?.[0].issue).toContain('@internal');
  });

  it('reports drift when member visibility contradicts doc tags', () => {
    const spec = buildSpec({
      id: 'class-visibility',
      name: 'class-visibility',
      kind: 'class',
      signatures: [],
      members: [
        {
          id: 'helper',
          name: 'helper',
          kind: 'method',
          visibility: 'protected',
          tags: [{ name: 'public', text: '' }],
        },
      ],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('class-visibility')?.drift;
    expect(drift?.some((signal) => signal.type === 'visibility-mismatch')).toBe(true);
    expect(drift?.[0].issue).toContain('@public');
  });

  it('does not report drift when @internal matches protected members', () => {
    const spec = buildSpec({
      id: 'aligned-visibility',
      name: 'aligned-visibility',
      kind: 'class',
      signatures: [],
      members: [
        {
          id: 'helper',
          name: 'helper',
          kind: 'method',
          visibility: 'protected',
          tags: [{ name: 'internal', text: '' }],
        },
      ],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('aligned-visibility')?.drift;
    expect(drift).toBeUndefined();
  });
});

