import type { OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import { sortByName } from '../core/query';

export type NavFormat = 'fumadocs' | 'docusaurus' | 'generic';
export type GroupBy = 'kind' | 'module' | 'tag' | 'none';

export interface NavOptions {
  /** Output format */
  format?: NavFormat;
  /** How to group exports */
  groupBy?: GroupBy;
  /** Base path for links */
  basePath?: string;
  /** Custom slug generator */
  slugify?: (name: string) => string;
  /** Include index pages for groups */
  includeGroupIndex?: boolean;
  /** Custom kind labels */
  kindLabels?: Partial<Record<SpecExportKind, string>>;
  /** Sort exports alphabetically */
  sortAlphabetically?: boolean;
}

// Generic nav types

export interface NavItem {
  title: string;
  href?: string;
  items?: NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  index?: string;
}

export interface GenericNav {
  title: string;
  groups: NavGroup[];
  items: NavItem[];
}

// Fumadocs types

export interface FumadocsMetaItem {
  title: string;
  pages?: string[];
  defaultOpen?: boolean;
}

export interface FumadocsMeta {
  root?: boolean;
  title?: string;
  pages?: (string | FumadocsMetaItem)[];
}

// Docusaurus types

export interface DocusaurusSidebarItem {
  type: 'category' | 'doc' | 'link';
  label: string;
  items?: DocusaurusSidebarItem[];
  id?: string;
  href?: string;
}

export type DocusaurusSidebar = DocusaurusSidebarItem[];

const defaultKindLabels: Record<SpecExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
  namespace: 'Namespaces',
  module: 'Modules',
  reference: 'References',
  external: 'External',
};

const defaultSlugify = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Extract module name from export.
 */
function getModuleName(exp: SpecExport): string {
  if (exp.source?.file) {
    const parts = exp.source.file.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart === 'index.ts' || lastPart === 'index.tsx') {
      return parts[parts.length - 2] || 'core';
    }
    return lastPart.replace(/\.[jt]sx?$/, '');
  }
  return 'core';
}

/**
 * Get primary tag from export.
 */
function getPrimaryTag(exp: SpecExport): string {
  const categoryTag = exp.tags?.find((t) => t.name === 'category' || t.name === '@category');
  if (categoryTag) return categoryTag.text;

  const moduleTag = exp.tags?.find((t) => t.name === 'module' || t.name === '@module');
  if (moduleTag) return moduleTag.text;

  return 'Other';
}

/**
 * Group exports by the specified grouping.
 */
function groupExports(exports: SpecExport[], groupBy: GroupBy): Map<string, SpecExport[]> {
  const groups = new Map<string, SpecExport[]>();

  for (const exp of exports) {
    let key: string;

    switch (groupBy) {
      case 'kind':
        key = exp.kind;
        break;
      case 'module':
        key = getModuleName(exp);
        break;
      case 'tag':
        key = getPrimaryTag(exp);
        break;
      default:
        key = 'all';
    }

    const existing = groups.get(key) ?? [];
    existing.push(exp);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Generate generic nav structure.
 */
function toGenericNav(spec: OpenPkg, options: NavOptions): GenericNav {
  const {
    groupBy = 'kind',
    basePath = '/api',
    slugify = defaultSlugify,
    kindLabels = {},
    sortAlphabetically = true,
    includeGroupIndex = false,
  } = options;

  const labels = { ...defaultKindLabels, ...kindLabels };
  const grouped = groupExports(spec.exports, groupBy);

  const groups: NavGroup[] = [];

  for (const [key, exports] of grouped) {
    const sortedExports = sortAlphabetically ? sortByName(exports) : exports;

    const items: NavItem[] = sortedExports.map((exp) => ({
      title: exp.name,
      href: `${basePath}/${slugify(exp.name)}`,
    }));

    const title = groupBy === 'kind' ? labels[key as SpecExportKind] || key : key;

    groups.push({
      title,
      items,
      index: includeGroupIndex ? `${basePath}/${slugify(key)}` : undefined,
    });
  }

  // Sort groups by kind order if grouping by kind
  if (groupBy === 'kind') {
    const kindOrder: SpecExportKind[] = [
      'function',
      'class',
      'interface',
      'type',
      'enum',
      'variable',
      'namespace',
      'module',
      'reference',
      'external',
    ];
    groups.sort((a, b) => {
      const aIdx = kindOrder.indexOf(a.title.toLowerCase().replace(/s$/, '') as SpecExportKind);
      const bIdx = kindOrder.indexOf(b.title.toLowerCase().replace(/s$/, '') as SpecExportKind);
      return aIdx - bIdx;
    });
  }

  // Flatten to items if no grouping
  const flatItems: NavItem[] =
    groupBy === 'none'
      ? groups.flatMap((g) => g.items)
      : groups.map((g) => ({
          title: g.title,
          items: g.items,
        }));

  return {
    title: `${spec.meta.name} API`,
    groups,
    items: flatItems,
  };
}

/**
 * Generate Fumadocs meta.json structure.
 */
function toFumadocsMeta(spec: OpenPkg, options: NavOptions): FumadocsMeta {
  const generic = toGenericNav(spec, options);
  const { slugify = defaultSlugify } = options;

  const pages: (string | FumadocsMetaItem)[] = generic.groups.map((group) => ({
    title: group.title,
    pages: group.items.map((item) => slugify(item.title)),
    defaultOpen: true,
  }));

  return {
    root: true,
    title: generic.title,
    pages,
  };
}

/**
 * Generate Docusaurus sidebar structure.
 */
function toDocusaurusSidebar(spec: OpenPkg, options: NavOptions): DocusaurusSidebar {
  const generic = toGenericNav(spec, options);
  const { slugify = defaultSlugify, basePath = 'api' } = options;

  const sidebar: DocusaurusSidebar = generic.groups.map((group) => ({
    type: 'category',
    label: group.title,
    items: group.items.map((item) => ({
      type: 'doc',
      id: `${basePath}/${slugify(item.title)}`,
      label: item.title,
    })),
  }));

  return sidebar;
}

/**
 * Generate navigation structure for doc frameworks.
 *
 * @param spec - The OpenPkg spec
 * @param options - Navigation options including format and grouping
 * @returns Navigation structure in requested format
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 *
 * // Generic nav
 * const nav = docs.toNavigation({ format: 'generic', groupBy: 'kind' })
 *
 * // Fumadocs meta.json
 * const meta = docs.toNavigation({ format: 'fumadocs' })
 *
 * // Docusaurus sidebar
 * const sidebar = docs.toNavigation({ format: 'docusaurus' })
 * ```
 */
export function toNavigation(
  spec: OpenPkg,
  options: NavOptions = {},
): GenericNav | FumadocsMeta | DocusaurusSidebar {
  const format = options.format ?? 'generic';

  switch (format) {
    case 'fumadocs':
      return toFumadocsMeta(spec, options);
    case 'docusaurus':
      return toDocusaurusSidebar(spec, options);
    default:
      return toGenericNav(spec, options);
  }
}

/**
 * Generate Fumadocs meta.json file content.
 *
 * @param spec - The OpenPkg spec
 * @param options - Navigation options (format is forced to fumadocs)
 * @returns JSON string for meta.json file
 *
 * @example
 * ```ts
 * const meta = toFumadocsMetaJSON(spec, { groupBy: 'kind' })
 * fs.writeFileSync('docs/api/meta.json', meta)
 * ```
 */
export function toFumadocsMetaJSON(
  spec: OpenPkg,
  options: Omit<NavOptions, 'format'> = {},
): string {
  const meta = toFumadocsMeta(spec, { ...options, format: 'fumadocs' });
  return JSON.stringify(meta, null, 2);
}

/**
 * Generate Docusaurus sidebar config.
 *
 * @param spec - The OpenPkg spec
 * @param options - Navigation options (format is forced to docusaurus)
 * @returns JavaScript module.exports string for sidebars.js
 *
 * @example
 * ```ts
 * const sidebar = toDocusaurusSidebarJS(spec, { basePath: 'api' })
 * fs.writeFileSync('sidebars.js', sidebar)
 * ```
 */
export function toDocusaurusSidebarJS(
  spec: OpenPkg,
  options: Omit<NavOptions, 'format'> = {},
): string {
  const sidebar = toDocusaurusSidebar(spec, { ...options, format: 'docusaurus' });
  return `module.exports = ${JSON.stringify(sidebar, null, 2)};`;
}
