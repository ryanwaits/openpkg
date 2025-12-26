import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { type SimplifiedExport, type SimplifiedSpec, toJSON, toJSONString } from './json';

const sampleSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-lib',
    version: '1.0.0',
    description: 'A test library',
  },
  exports: [
    {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      description: 'Greet a user.',
      signatures: [
        {
          parameters: [
            { name: 'name', schema: { type: 'string' }, required: true, description: 'User name' },
            { name: 'formal', schema: { type: 'boolean' }, required: false, default: false },
          ],
          returns: { schema: { type: 'string' }, description: 'Greeting' },
        },
      ],
      examples: [{ title: 'Basic', code: 'greet("World")', language: 'ts' }],
      tags: [{ name: 'example', text: 'greet("World")' }],
      source: { file: 'src/greet.ts', line: 10 },
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'Logger class.',
      deprecated: true,
      extends: 'EventEmitter',
      implements: ['Disposable'],
      members: [
        {
          name: 'info',
          kind: 'method',
          description: 'Log info',
          signatures: [{ parameters: [{ name: 'msg', schema: { type: 'string' } }] }],
        },
        {
          name: 'level',
          kind: 'property',
          description: 'Log level',
          schema: { type: 'string' },
          visibility: 'protected',
        },
      ],
    },
  ],
};

describe('toJSON', () => {
  test('returns simplified spec', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;

    expect(json.name).toBe('test-lib');
    expect(json.version).toBe('1.0.0');
    expect(json.description).toBe('A test library');
    expect(json.totalExports).toBe(2);
  });

  test('includes exports array', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;

    expect(json.exports).toHaveLength(2);
    expect(json.exports[0].name).toBe('greet');
    expect(json.exports[1].name).toBe('Logger');
  });

  test('groups by kind', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;

    expect(json.byKind.function).toHaveLength(1);
    expect(json.byKind.class).toHaveLength(1);
  });

  test('simplifies function export', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;
    const fn = json.exports[0];

    expect(fn.id).toBe('greet');
    expect(fn.kind).toBe('function');
    expect(fn.signature).toContain('function greet');
    expect(fn.parameters).toHaveLength(2);
    expect(fn.parameters?.[0].name).toBe('name');
    expect(fn.parameters?.[0].type).toBe('string');
    expect(fn.parameters?.[0].required).toBe(true);
    expect(fn.parameters?.[1].default).toBe(false);
    expect(fn.returns?.type).toBe('string');
    expect(fn.sourceFile).toBe('src/greet.ts');
    expect(fn.sourceLine).toBe(10);
  });

  test('simplifies class export', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;
    const cls = json.exports[1];

    expect(cls.deprecated).toBe(true);
    expect(cls.extends).toBe('EventEmitter');
    expect(cls.implements).toContain('Disposable');
    expect(cls.members).toHaveLength(2);
    expect(cls.members?.[0].kind).toBe('method');
    expect(cls.members?.[1].kind).toBe('property');
    expect(cls.members?.[1].visibility).toBe('protected');
  });

  test('simplifies examples', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;
    const fn = json.exports[0];

    expect(fn.examples).toHaveLength(1);
    expect(fn.examples?.[0].title).toBe('Basic');
    expect(fn.examples?.[0].code).toBe('greet("World")');
    expect(fn.examples?.[0].language).toBe('ts');
  });

  test('simplifies tags', () => {
    const json = toJSON(sampleSpec) as SimplifiedSpec;
    const fn = json.exports[0];

    expect(fn.tags).toHaveLength(1);
    expect(fn.tags[0].name).toBe('example');
  });

  test('single export mode', () => {
    const json = toJSON(sampleSpec, { export: 'greet' }) as SimplifiedExport;

    expect(json.id).toBe('greet');
    expect(json.name).toBe('greet');
    expect('exports' in json).toBe(false);
  });

  test('throws for unknown export', () => {
    expect(() => toJSON(sampleSpec, { export: 'unknown' })).toThrow('Export not found');
  });
});

describe('toJSONString', () => {
  test('returns JSON string', () => {
    const jsonStr = toJSONString(sampleSpec);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.name).toBe('test-lib');
    expect(parsed.exports).toHaveLength(2);
  });

  test('pretty prints when enabled', () => {
    const compact = toJSONString(sampleSpec);
    const pretty = toJSONString(sampleSpec, { pretty: true });

    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(pretty).toContain('\n');
  });
});
