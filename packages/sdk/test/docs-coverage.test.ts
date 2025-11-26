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

describe('docs coverage return type drift detection', () => {
  it('reports drift when @returns type contradicts the signature', () => {
    const spec = buildSpec({
      id: 'return-drift',
      name: 'return-drift',
      signatures: [
        {
          parameters: [],
          returns: { schema: { type: 'number' }, description: 'A number' },
        },
      ],
      tags: [{ name: 'returns', text: '{string} The result as a string' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('return-drift')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'return-type-mismatch',
      target: 'returns',
    });
    expect(drift?.[0].issue).toContain('string');
    expect(drift?.[0].issue).toContain('number');
  });

  it('does not report drift when @returns type matches the signature', () => {
    const spec = buildSpec({
      id: 'return-aligned',
      name: 'return-aligned',
      signatures: [
        {
          parameters: [],
          returns: { schema: { type: 'boolean' }, description: 'True if valid' },
        },
      ],
      tags: [{ name: 'returns', text: '{boolean} True if valid' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('return-aligned')?.drift;
    expect(drift).toBeUndefined();
  });

  it('treats void and undefined as equivalent', () => {
    const spec = buildSpec({
      id: 'void-undefined',
      name: 'void-undefined',
      signatures: [
        {
          parameters: [],
          returns: { schema: { type: 'void' }, description: 'Nothing' },
        },
      ],
      tags: [{ name: 'returns', text: '{undefined} Nothing' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('void-undefined')?.drift;
    expect(drift).toBeUndefined();
  });
});

describe('docs coverage optionality drift detection', () => {
  it('reports drift when docs mark optional but signature requires', () => {
    const spec = buildSpec({
      id: 'optional-required',
      name: 'optional-required',
      signatures: [
        {
          parameters: [{ name: 'message', required: true, schema: { type: 'string' } }],
        },
      ],
      tags: [{ name: 'param', text: '[message] - Optional message' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('optional-required')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'optionality-mismatch',
      target: 'message',
    });
    expect(drift?.[0].issue).toContain('optional');
    expect(drift?.[0].issue).toContain('requires');
  });

  it('reports drift when docs mark required but signature is optional', () => {
    const spec = buildSpec({
      id: 'required-optional',
      name: 'required-optional',
      signatures: [
        {
          parameters: [{ name: 'label', required: false, schema: { type: 'string' } }],
        },
      ],
      tags: [{ name: 'param', text: 'label - Required label' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('required-optional')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'optionality-mismatch',
      target: 'label',
    });
    expect(drift?.[0].issue).toContain('optional');
  });

  it('does not report drift when optionality matches', () => {
    const spec = buildSpec({
      id: 'optional-aligned',
      name: 'optional-aligned',
      signatures: [
        {
          parameters: [{ name: 'suffix', required: false, schema: { type: 'string' } }],
        },
      ],
      tags: [{ name: 'param', text: '[suffix] - Optional suffix' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('optional-aligned')?.drift;
    expect(drift).toBeUndefined();
  });
});

describe('docs coverage deprecated drift detection', () => {
  it('reports drift when code is deprecated but docs lack @deprecated', () => {
    const spec = buildSpec({
      id: 'code-deprecated',
      name: 'code-deprecated',
      deprecated: true,
      tags: [],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('code-deprecated')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'deprecated-mismatch',
      target: 'code-deprecated',
    });
    expect(drift?.[0].issue).toContain('@deprecated is missing');
  });

  it('reports drift when docs have @deprecated but code is not', () => {
    const spec = buildSpec({
      id: 'docs-deprecated',
      name: 'docs-deprecated',
      deprecated: false,
      tags: [{ name: 'deprecated', text: 'Use newMethod instead' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('docs-deprecated')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'deprecated-mismatch',
      target: 'docs-deprecated',
    });
    expect(drift?.[0].issue).toContain('declaration is not');
  });

  it('does not report drift when both agree on deprecated status', () => {
    const spec = buildSpec({
      id: 'both-deprecated',
      name: 'both-deprecated',
      deprecated: true,
      tags: [{ name: 'deprecated', text: 'Use newMethod instead' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('both-deprecated')?.drift;
    expect(drift).toBeUndefined();
  });
});

describe('docs coverage example drift detection', () => {
  it('reports drift when @example references non-existent export', () => {
    const spec: OpenPkgSpec = {
      openpkg: '0.2.0',
      meta: { name: 'fixture' },
      exports: [
        {
          id: 'example-drift',
          name: 'calculateDiscount',
          kind: 'function',
          signatures: [],
          examples: [
            "import { calculateDiscount, PriceConfg } from './index';\nconst config: PriceConfg = { rate: 0.1 };",
          ],
        },
        {
          id: 'PriceConfig',
          name: 'PriceConfig',
          kind: 'interface',
          signatures: [],
        },
      ],
    };

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('example-drift')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'example-drift',
      target: 'PriceConfg',
    });
    expect(drift?.[0].suggestion).toContain('PriceConfig');
  });

  it('does not report drift for valid export references', () => {
    const spec: OpenPkgSpec = {
      openpkg: '0.2.0',
      meta: { name: 'fixture' },
      exports: [
        {
          id: 'valid-example',
          name: 'formatPrice',
          kind: 'function',
          signatures: [],
          examples: [
            "import { formatPrice, PriceConfig } from './index';\nconst result = formatPrice(19.99);",
          ],
        },
        {
          id: 'PriceConfig',
          name: 'PriceConfig',
          kind: 'interface',
          signatures: [],
        },
      ],
    };

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('valid-example')?.drift;
    expect(drift).toBeUndefined();
  });
});

describe('docs coverage broken link detection', () => {
  it('reports drift for broken {@link} references', () => {
    const spec: OpenPkgSpec = {
      openpkg: '0.2.0',
      meta: { name: 'fixture' },
      exports: [
        {
          id: 'broken-link',
          name: 'processOrder',
          kind: 'function',
          signatures: [],
          description: 'See {@link MissingType} for details.',
        },
      ],
    };

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('broken-link')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'broken-link',
      target: 'MissingType',
    });
    expect(drift?.[0].issue).toContain('does not exist');
  });

  it('suggests similar exports for typos in links', () => {
    const spec: OpenPkgSpec = {
      openpkg: '0.2.0',
      meta: { name: 'fixture' },
      exports: [
        {
          id: 'typo-link',
          name: 'getOrderService',
          kind: 'function',
          signatures: [],
          description: 'Uses {@link OrderServce} for processing.',
        },
        {
          id: 'OrderService',
          name: 'OrderService',
          kind: 'class',
          signatures: [],
        },
      ],
    };

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('typo-link')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.[0]).toMatchObject({
      type: 'broken-link',
      target: 'OrderServce',
    });
    expect(drift?.[0].suggestion).toContain('OrderService');
  });

  it('does not report drift for valid {@link} references', () => {
    const spec: OpenPkgSpec = {
      openpkg: '0.2.0',
      meta: { name: 'fixture' },
      exports: [
        {
          id: 'valid-link',
          name: 'validateOrder',
          kind: 'function',
          signatures: [],
          description: 'See {@link OrderService} for the service class.',
        },
        {
          id: 'OrderService',
          name: 'OrderService',
          kind: 'class',
          signatures: [],
        },
      ],
    };

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('valid-link')?.drift;
    expect(drift).toBeUndefined();
  });
});

describe('docs coverage example syntax error detection', () => {
  it('reports drift when @example contains invalid syntax (missing brace)', () => {
    const spec = buildSpec({
      id: 'syntax-error',
      name: 'processConfig',
      examples: ["const config = { name: 'test'\nprocessConfig(config);"],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('syntax-error')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.some((d) => d.type === 'example-syntax-error')).toBe(true);
  });

  it('reports drift when @example has unclosed parenthesis', () => {
    const spec = buildSpec({
      id: 'unclosed-paren',
      name: 'calculateSum',
      examples: ['const result = calculateSum(1, 2, 3;\nconsole.log(result);'],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('unclosed-paren')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.some((d) => d.type === 'example-syntax-error')).toBe(true);
  });

  it('does not report drift for valid example syntax', () => {
    const spec = buildSpec({
      id: 'valid-syntax',
      name: 'formatGreeting',
      examples: ["const greeting = formatGreeting('World');\nconsole.log(greeting);"],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('valid-syntax')?.drift;
    expect(drift?.some((d) => d.type === 'example-syntax-error')).toBeFalsy();
  });
});

describe('docs coverage async mismatch detection', () => {
  it('reports drift when async function lacks Promise documentation', () => {
    const spec = buildSpec({
      id: 'async-no-docs',
      name: 'fetchData',
      signatures: [
        {
          parameters: [],
          returns: { tsType: 'Promise<string>', description: 'The fetched data' },
        },
      ],
      tags: [{ name: 'returns', text: 'The fetched data as a string' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('async-no-docs')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.some((d) => d.type === 'async-mismatch')).toBe(true);
    expect(drift?.find((d) => d.type === 'async-mismatch')?.issue).toContain('Promise');
  });

  it('reports drift when sync function has @async tag', () => {
    const spec = buildSpec({
      id: 'sync-with-async',
      name: 'computeValue',
      signatures: [
        {
          parameters: [],
          returns: { schema: { type: 'number' }, description: 'The computed value' },
        },
      ],
      tags: [{ name: 'async', text: '' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('sync-with-async')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.some((d) => d.type === 'async-mismatch')).toBe(true);
  });

  it('does not report drift when async is properly documented', () => {
    const spec = buildSpec({
      id: 'async-aligned',
      name: 'processAsync',
      signatures: [
        {
          parameters: [],
          returns: { tsType: 'Promise<number>', description: 'The result' },
        },
      ],
      tags: [{ name: 'async', text: '' }],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('async-aligned')?.drift;
    expect(drift?.some((d) => d.type === 'async-mismatch')).toBeFalsy();
  });
});

describe('docs coverage property type drift detection', () => {
  it('reports drift when @type annotation differs from actual type', () => {
    const spec = buildSpec({
      id: 'class-with-drift',
      name: 'UserProfile',
      kind: 'class',
      signatures: [],
      members: [
        {
          id: 'age',
          name: 'age',
          kind: 'property',
          schema: { type: 'number' },
          tags: [{ name: 'type', text: '{string}' }],
        },
      ],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('class-with-drift')?.drift;
    expect(drift).toBeDefined();
    expect(drift?.some((d) => d.type === 'property-type-drift')).toBe(true);
    expect(drift?.find((d) => d.type === 'property-type-drift')?.target).toBe('age');
  });

  it('does not report drift when @type matches actual type', () => {
    const spec = buildSpec({
      id: 'class-aligned',
      name: 'UserProfile',
      kind: 'class',
      signatures: [],
      members: [
        {
          id: 'active',
          name: 'active',
          kind: 'property',
          schema: { type: 'boolean' },
          tags: [{ name: 'type', text: '{boolean}' }],
        },
      ],
    });

    const result = computeDocsCoverage(spec);
    const drift = result.exports.get('class-aligned')?.drift;
    expect(drift?.some((d) => d.type === 'property-type-drift')).toBeFalsy();
  });
});
