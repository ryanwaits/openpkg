import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { createDocs, loadSpec } from './loader';

const sampleSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-lib',
    version: '1.0.0',
    description: 'Test library',
  },
  exports: [
    {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      description: 'Greet a user',
      signatures: [
        {
          parameters: [{ name: 'name', schema: { type: 'string' }, required: true }],
          returns: { schema: { type: 'string' } },
        },
      ],
      tags: [{ name: 'param', text: 'name - User name' }],
      source: { file: 'src/greet.ts', line: 1 },
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'Logger class',
      members: [
        { name: 'info', kind: 'method', signatures: [{ parameters: [] }] },
        { name: 'level', kind: 'property', schema: { type: 'string' } },
      ],
      deprecated: true,
    },
    {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      description: 'Config interface',
      members: [{ name: 'debug', kind: 'property', schema: { type: 'boolean' } }],
      tags: [{ name: 'beta', text: '' }],
    },
  ],
  types: [{ id: 'Config', name: 'Config', kind: 'interface' }],
};

describe('loadSpec', () => {
  test('loads spec from object', () => {
    const docs = loadSpec(sampleSpec);
    expect(docs.spec).toBe(sampleSpec);
  });

  test('getExport returns export by id', () => {
    const docs = loadSpec(sampleSpec);
    const fn = docs.getExport('greet');
    expect(fn?.name).toBe('greet');
    expect(fn?.kind).toBe('function');
  });

  test('getExport returns undefined for unknown id', () => {
    const docs = loadSpec(sampleSpec);
    expect(docs.getExport('unknown')).toBeUndefined();
  });

  test('getType returns type by id', () => {
    const docs = loadSpec(sampleSpec);
    const type = docs.getType('Config');
    expect(type?.name).toBe('Config');
  });

  test('getExportsByKind returns exports of specific kind', () => {
    const docs = loadSpec(sampleSpec);
    const functions = docs.getExportsByKind('function');
    expect(functions).toHaveLength(1);
    expect(functions[0].name).toBe('greet');
  });

  test('getAllExports returns all exports', () => {
    const docs = loadSpec(sampleSpec);
    expect(docs.getAllExports()).toHaveLength(3);
  });

  test('getAllTypes returns all types', () => {
    const docs = loadSpec(sampleSpec);
    expect(docs.getAllTypes()).toHaveLength(1);
  });
});

describe('createDocs', () => {
  test('creates docs from spec object', () => {
    const docs = createDocs(sampleSpec);
    expect(docs.spec.meta.name).toBe('test-lib');
  });
});

describe('DocsInstance queries', () => {
  test('getExportsByTag returns exports with tag', () => {
    const docs = loadSpec(sampleSpec);
    const beta = docs.getExportsByTag('@beta');
    expect(beta).toHaveLength(1);
    expect(beta[0].name).toBe('Config');
  });

  test('getExportsByTag normalizes tag names', () => {
    const docs = loadSpec(sampleSpec);
    const beta = docs.getExportsByTag('beta'); // without @
    expect(beta).toHaveLength(1);
  });

  test('search finds by name', () => {
    const docs = loadSpec(sampleSpec);
    const results = docs.search('greet');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('greet');
  });

  test('search finds by description', () => {
    const docs = loadSpec(sampleSpec);
    const results = docs.search('class');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Logger');
  });

  test('search is case-insensitive', () => {
    const docs = loadSpec(sampleSpec);
    const results = docs.search('LOGGER');
    expect(results).toHaveLength(1);
  });

  test('getModule returns exports by module', () => {
    const docs = loadSpec(sampleSpec);
    const greetModule = docs.getModule('greet');
    expect(greetModule).toHaveLength(1);
  });

  test('getDeprecated returns deprecated exports', () => {
    const docs = loadSpec(sampleSpec);
    const deprecated = docs.getDeprecated();
    expect(deprecated).toHaveLength(1);
    expect(deprecated[0].name).toBe('Logger');
  });

  test('groupByKind groups exports', () => {
    const docs = loadSpec(sampleSpec);
    const groups = docs.groupByKind();
    expect(groups.function).toHaveLength(1);
    expect(groups.class).toHaveLength(1);
    expect(groups.interface).toHaveLength(1);
  });
});

describe('DocsInstance render methods', () => {
  test('toMarkdown returns MDX string', () => {
    const docs = loadSpec(sampleSpec);
    const mdx = docs.toMarkdown();
    expect(mdx).toContain('# test-lib API Reference');
    expect(mdx).toContain('## Functions');
  });

  test('toMarkdown single export mode', () => {
    const docs = loadSpec(sampleSpec);
    const mdx = docs.toMarkdown({ export: 'greet' });
    expect(mdx).toContain('# greet');
    expect(mdx).not.toContain('# test-lib');
  });

  test('toHTML returns HTML string', () => {
    const docs = loadSpec(sampleSpec);
    const html = docs.toHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('test-lib API Reference');
  });

  test('toJSON returns simplified structure', () => {
    const docs = loadSpec(sampleSpec);
    const json = docs.toJSON() as { name: string; exports: unknown[] };
    expect(json.name).toBe('test-lib');
    expect(json.exports).toHaveLength(3);
  });

  test('toNavigation returns nav structure', () => {
    const docs = loadSpec(sampleSpec);
    const nav = docs.toNavigation() as { groups: unknown[] };
    expect(nav.groups).toBeDefined();
  });

  test('toSearchIndex returns search index', () => {
    const docs = loadSpec(sampleSpec);
    const index = docs.toSearchIndex();
    expect(index.records).toHaveLength(3);
    expect(index.packageName).toBe('test-lib');
  });
});
