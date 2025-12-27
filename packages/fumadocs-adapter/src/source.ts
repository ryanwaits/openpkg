import type { Source, VirtualFile } from 'fumadocs-core/source';
import type { DocsInstance, OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/doc-generator';
import { createDocs } from '@openpkg-ts/doc-generator';

export interface OpenPkgSourceOptions {
  /** OpenPkg spec or DocsInstance */
  spec: OpenPkg | DocsInstance;
  /** Base directory for pages (default: 'api') */
  baseDir?: string;
}

export interface OpenPkgPageData {
  title: string;
  description?: string;
  /** The export from the spec */
  export: SpecExport;
  /** The full OpenPkg spec */
  spec: OpenPkg;
}

export interface OpenPkgMetaData {
  title: string;
  pages: string[];
  defaultOpen?: boolean;
}

const KIND_ORDER: SpecExportKind[] = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
];

const KIND_LABELS: Partial<Record<SpecExportKind, string>> = {
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

/**
 * Create a virtual source for Fumadocs from an OpenPkg spec.
 *
 * This generates virtual pages grouped by export kind (functions, types, etc.)
 * that integrate with Fumadocs' loader and sidebar.
 *
 * @example
 * ```ts
 * import { loader } from 'fumadocs-core/source';
 * import { openpkgSource } from '@openpkg-ts/fumadocs-adapter';
 * import spec from './openpkg.json';
 *
 * export const source = loader({
 *   baseUrl: '/docs/api',
 *   source: openpkgSource({ spec }),
 * });
 * ```
 */
export function openpkgSource(
  options: OpenPkgSourceOptions
): Source<{ pageData: OpenPkgPageData; metaData: OpenPkgMetaData }> {
  const { baseDir = 'api' } = options;

  // Normalize to DocsInstance
  const docs: DocsInstance =
    'getAllExports' in options.spec ? options.spec : createDocs(options.spec);

  const spec = docs.spec;
  const exports = docs.getAllExports();

  // Group exports by kind
  const groupedByKind = new Map<SpecExportKind, SpecExport[]>();
  for (const exp of exports) {
    const kind = exp.kind as SpecExportKind;
    if (!groupedByKind.has(kind)) {
      groupedByKind.set(kind, []);
    }
    groupedByKind.get(kind)!.push(exp);
  }

  const files: VirtualFile<{ pageData: OpenPkgPageData; metaData: OpenPkgMetaData }>[] = [];

  // Create root meta for the API section
  const rootPages: string[] = [];
  for (const kind of KIND_ORDER) {
    if (groupedByKind.has(kind)) {
      rootPages.push(`...${kind}s`);
    }
  }

  files.push({
    type: 'meta',
    path: `${baseDir}/meta.json`,
    data: {
      title: spec.meta.name || 'API Reference',
      pages: rootPages,
      defaultOpen: true,
    },
  });

  // Create pages and meta for each kind group
  for (const kind of KIND_ORDER) {
    const kindExports = groupedByKind.get(kind);
    if (!kindExports || kindExports.length === 0) continue;

    const kindDir = `${baseDir}/${kind}s`;
    const label = KIND_LABELS[kind] || `${kind}s`;

    // Sort exports alphabetically
    const sortedExports = [...kindExports].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Create meta for this kind folder
    files.push({
      type: 'meta',
      path: `${kindDir}/meta.json`,
      data: {
        title: label,
        pages: sortedExports.map((exp) => exp.id),
        defaultOpen: false,
      },
    });

    // Create a page for each export
    for (const exp of sortedExports) {
      files.push({
        type: 'page',
        path: `${kindDir}/${exp.id}.mdx`,
        slugs: [kind + 's', exp.id],
        data: {
          title: exp.name,
          description: exp.description,
          export: exp,
          spec,
        },
      });
    }
  }

  return { files };
}
