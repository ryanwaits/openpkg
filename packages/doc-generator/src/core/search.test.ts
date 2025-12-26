import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { toAlgoliaRecords, toPagefindRecords, toSearchIndex, toSearchIndexJSON } from './search';

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
      description: 'Greet a user by name',
      signatures: [
        {
          parameters: [
            { name: 'name', schema: { type: 'string' }, required: true, description: 'User name' },
          ],
          returns: { schema: { type: 'string' } },
        },
      ],
      tags: [{ name: 'example', text: 'greet("World")' }],
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'Logging utility',
      deprecated: true,
      members: [
        { name: 'info', signatures: [{ parameters: [] }] },
        { name: 'level', schema: { type: 'string' } },
      ],
      tags: [{ name: 'beta', text: '' }],
    },
  ],
};

describe('toSearchIndex', () => {
  test('generates search index', () => {
    const index = toSearchIndex(sampleSpec);
    expect(index.records).toHaveLength(2);
    expect(index.version).toBe('1.0.0');
    expect(index.packageName).toBe('test-lib');
    expect(index.generatedAt).toBeDefined();
  });

  test('includes record fields', () => {
    const index = toSearchIndex(sampleSpec);
    const greet = index.records[0];
    expect(greet.id).toBe('greet');
    expect(greet.name).toBe('greet');
    expect(greet.kind).toBe('function');
    expect(greet.signature).toContain('function greet');
    expect(greet.description).toBe('Greet a user by name');
    expect(greet.deprecated).toBe(false);
  });

  test('marks deprecated exports', () => {
    const index = toSearchIndex(sampleSpec);
    const logger = index.records[1];
    expect(logger.deprecated).toBe(true);
  });

  test('respects baseUrl option', () => {
    const index = toSearchIndex(sampleSpec, { baseUrl: '/docs/api' });
    expect(index.records[0].url).toBe('/docs/api/greet');
  });

  test('respects custom slugify', () => {
    const index = toSearchIndex(sampleSpec, {
      slugify: (name) => name.toUpperCase(),
    });
    expect(index.records[0].url).toBe('/api/GREET');
  });

  test('extracts keywords', () => {
    const index = toSearchIndex(sampleSpec);
    const greet = index.records[0];
    expect(greet.keywords).toContain('greet');
    expect(greet.keywords).toContain('user');
  });

  test('includes members in content when enabled', () => {
    const index = toSearchIndex(sampleSpec, { includeMembers: true });
    const logger = index.records[1];
    expect(logger.content).toContain('info');
    expect(logger.content).toContain('level');
  });

  test('includes parameters in content when enabled', () => {
    const index = toSearchIndex(sampleSpec, { includeParameters: true });
    const greet = index.records[0];
    expect(greet.content).toContain('name');
  });
});

describe('toPagefindRecords', () => {
  test('generates pagefind records', () => {
    const records = toPagefindRecords(sampleSpec);
    expect(records).toHaveLength(2);
  });

  test('includes correct fields', () => {
    const records = toPagefindRecords(sampleSpec);
    const greet = records[0];
    expect(greet.url).toBe('/api/greet');
    expect(greet.content).toBeDefined();
    expect(greet.word_count).toBeGreaterThan(0);
    expect(greet.meta.title).toBe('greet');
    expect(greet.meta.kind).toBe('function');
  });

  test('includes filters', () => {
    const records = toPagefindRecords(sampleSpec);
    const greet = records[0];
    expect(greet.filters.kind).toContain('function');
  });

  test('marks deprecated in filters', () => {
    const records = toPagefindRecords(sampleSpec);
    const logger = records[1];
    expect(logger.filters.deprecated).toContain('true');
  });

  test('includes tags in filters', () => {
    const records = toPagefindRecords(sampleSpec);
    const logger = records[1];
    expect(logger.filters.tags).toContain('beta');
  });

  test('applies weight options', () => {
    const records = toPagefindRecords(sampleSpec, {
      weights: { name: 20, description: 10 },
    });
    const greet = records[0];
    const nameSection = greet.weighted_sections?.find((s) => s.text === 'greet');
    expect(nameSection?.weight).toBe(20);
  });
});

describe('toAlgoliaRecords', () => {
  test('generates algolia records', () => {
    const records = toAlgoliaRecords(sampleSpec);
    expect(records).toHaveLength(2);
  });

  test('includes correct fields', () => {
    const records = toAlgoliaRecords(sampleSpec);
    const greet = records[0];
    expect(greet.objectID).toBe('greet');
    expect(greet.name).toBe('greet');
    expect(greet.kind).toBe('function');
    expect(greet.signature).toContain('function greet');
    expect(greet.url).toBe('/api/greet');
  });

  test('includes hierarchy', () => {
    const records = toAlgoliaRecords(sampleSpec);
    const greet = records[0];
    expect(greet.hierarchy.lvl0).toBe('test-lib');
    expect(greet.hierarchy.lvl1).toBe('Functions');
    expect(greet.hierarchy.lvl2).toBe('greet');
  });

  test('extracts tags', () => {
    const records = toAlgoliaRecords(sampleSpec);
    const logger = records[1];
    expect(logger.tags).toContain('beta');
  });

  test('marks deprecated', () => {
    const records = toAlgoliaRecords(sampleSpec);
    const logger = records[1];
    expect(logger.deprecated).toBe(true);
  });
});

describe('toSearchIndexJSON', () => {
  test('returns JSON string', () => {
    const json = toSearchIndexJSON(sampleSpec);
    const parsed = JSON.parse(json);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.packageName).toBe('test-lib');
  });

  test('pretty prints when enabled', () => {
    const compact = toSearchIndexJSON(sampleSpec);
    const pretty = toSearchIndexJSON(sampleSpec, { pretty: true });
    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(pretty).toContain('\n');
  });
});
