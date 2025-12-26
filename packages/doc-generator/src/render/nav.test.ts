import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import {
  type DocusaurusSidebar,
  type FumadocsMeta,
  type GenericNav,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  toNavigation,
} from './nav';

const sampleSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-lib',
    version: '1.0.0',
  },
  exports: [
    { id: 'greet', name: 'greet', kind: 'function', source: { file: 'src/core/greet.ts' } },
    { id: 'hello', name: 'hello', kind: 'function', source: { file: 'src/core/hello.ts' } },
    { id: 'Logger', name: 'Logger', kind: 'class' },
    {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      tags: [{ name: 'category', text: 'Utils' }],
    },
    { id: 'Status', name: 'Status', kind: 'enum' },
  ],
};

describe('toNavigation', () => {
  describe('generic format', () => {
    test('returns generic nav structure', () => {
      const nav = toNavigation(sampleSpec) as GenericNav;

      expect(nav.title).toBe('test-lib API');
      expect(nav.groups).toBeDefined();
      expect(nav.items).toBeDefined();
    });

    test('groups by kind by default', () => {
      const nav = toNavigation(sampleSpec, { groupBy: 'kind' }) as GenericNav;

      expect(nav.groups.find((g) => g.title === 'Functions')).toBeDefined();
      expect(nav.groups.find((g) => g.title === 'Classes')).toBeDefined();
      expect(nav.groups.find((g) => g.title === 'Interfaces')).toBeDefined();
    });

    test('groups by module', () => {
      const nav = toNavigation(sampleSpec, { groupBy: 'module' }) as GenericNav;

      expect(nav.groups.find((g) => g.title === 'greet')).toBeDefined();
    });

    test('groups by tag', () => {
      const nav = toNavigation(sampleSpec, { groupBy: 'tag' }) as GenericNav;

      expect(nav.groups.find((g) => g.title === 'Utils')).toBeDefined();
      expect(nav.groups.find((g) => g.title === 'Other')).toBeDefined();
    });

    test('no grouping flattens items', () => {
      const nav = toNavigation(sampleSpec, { groupBy: 'none' }) as GenericNav;

      expect(nav.items.length).toBe(5);
      expect(nav.items[0].title).toBeDefined();
    });

    test('respects basePath', () => {
      const nav = toNavigation(sampleSpec, { basePath: '/docs/api' }) as GenericNav;

      expect(nav.groups[0].items[0].href).toContain('/docs/api/');
    });

    test('respects custom slugify', () => {
      const nav = toNavigation(sampleSpec, {
        slugify: (name) => name.toUpperCase(),
      }) as GenericNav;

      const fnGroup = nav.groups.find((g) => g.title === 'Functions');
      expect(fnGroup?.items[0].href).toContain('GREET');
    });

    test('sorts alphabetically by default', () => {
      const nav = toNavigation(sampleSpec, { sortAlphabetically: true }) as GenericNav;
      const fnGroup = nav.groups.find((g) => g.title === 'Functions');

      expect(fnGroup?.items[0].title).toBe('greet');
      expect(fnGroup?.items[1].title).toBe('hello');
    });

    test('includes group index when enabled', () => {
      const nav = toNavigation(sampleSpec, { includeGroupIndex: true }) as GenericNav;

      expect(nav.groups[0].index).toBeDefined();
    });

    test('respects custom kind labels', () => {
      const nav = toNavigation(sampleSpec, {
        kindLabels: { function: 'Methods' },
      }) as GenericNav;

      expect(nav.groups.find((g) => g.title === 'Methods')).toBeDefined();
      expect(nav.groups.find((g) => g.title === 'Functions')).toBeUndefined();
    });
  });

  describe('fumadocs format', () => {
    test('returns fumadocs meta structure', () => {
      const meta = toNavigation(sampleSpec, { format: 'fumadocs' }) as FumadocsMeta;

      expect(meta.root).toBe(true);
      expect(meta.title).toBe('test-lib API');
      expect(meta.pages).toBeDefined();
    });

    test('pages include groups with items', () => {
      const meta = toNavigation(sampleSpec, { format: 'fumadocs' }) as FumadocsMeta;

      expect(Array.isArray(meta.pages)).toBe(true);
      const fnGroup = meta.pages?.find((p) => typeof p === 'object' && p.title === 'Functions');
      expect(fnGroup).toBeDefined();
    });
  });

  describe('docusaurus format', () => {
    test('returns docusaurus sidebar structure', () => {
      const sidebar = toNavigation(sampleSpec, { format: 'docusaurus' }) as DocusaurusSidebar;

      expect(Array.isArray(sidebar)).toBe(true);
      expect(sidebar[0].type).toBe('category');
    });

    test('categories contain docs', () => {
      const sidebar = toNavigation(sampleSpec, { format: 'docusaurus' }) as DocusaurusSidebar;
      const fnCategory = sidebar.find((s) => s.label === 'Functions');

      expect(fnCategory?.items).toBeDefined();
      expect(fnCategory?.items?.[0].type).toBe('doc');
    });
  });
});

describe('toFumadocsMetaJSON', () => {
  test('returns JSON string', () => {
    const json = toFumadocsMetaJSON(sampleSpec);
    const parsed = JSON.parse(json);

    expect(parsed.root).toBe(true);
    expect(parsed.title).toBe('test-lib API');
  });

  test('is pretty printed', () => {
    const json = toFumadocsMetaJSON(sampleSpec);

    expect(json).toContain('\n');
  });
});

describe('toDocusaurusSidebarJS', () => {
  test('returns module.exports string', () => {
    const js = toDocusaurusSidebarJS(sampleSpec);

    expect(js).toContain('module.exports =');
  });

  test('is valid JavaScript', () => {
    const js = toDocusaurusSidebarJS(sampleSpec);
    const jsonPart = js.replace('module.exports = ', '').replace(/;$/, '');

    expect(() => JSON.parse(jsonPart)).not.toThrow();
  });
});
