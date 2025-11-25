import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LoadContext, Plugin } from '@docusaurus/types';
import type { OpenPkg, SpecExport, SpecType } from '@openpkg-ts/spec';

export interface DocCovPluginOptions {
  /** Path to openpkg.json file (default: './openpkg.json') */
  specPath?: string;
  /** Route base path for API docs (default: '/api') */
  routeBasePath?: string;
  /** Whether to show coverage badges (default: true) */
  showCoverage?: boolean;
  /** Minimum coverage to show green badge (default: 80) */
  coverageThreshold?: number;
}

interface DocCovPluginContent {
  spec: OpenPkg | null;
}

export default function docusaurusPluginDocCov(
  context: LoadContext,
  options: DocCovPluginOptions,
): Plugin<DocCovPluginContent> {
  const {
    specPath = './openpkg.json',
    routeBasePath = '/api',
    showCoverage = true,
    coverageThreshold = 80,
  } = options;

  return {
    name: 'docusaurus-plugin-doccov',

    async loadContent(): Promise<DocCovPluginContent> {
      const absoluteSpecPath = path.resolve(context.siteDir, specPath);

      if (!fs.existsSync(absoluteSpecPath)) {
        console.warn(`[DocCov] Spec file not found at ${absoluteSpecPath}`);
        return { spec: null };
      }

      try {
        const content = fs.readFileSync(absoluteSpecPath, 'utf-8');
        const spec = JSON.parse(content) as OpenPkg;
        return { spec };
      } catch (error) {
        console.error(`[DocCov] Failed to load spec:`, error);
        return { spec: null };
      }
    },

    async contentLoaded({ content, actions }) {
      const { createData, addRoute } = actions;
      const { spec } = content;

      if (!spec) {
        return;
      }

      // Create data file for the spec
      const specDataPath = await createData('spec.json', JSON.stringify(spec, null, 2));

      // Create index page data
      const indexData = {
        meta: spec.meta,
        coverage: spec.docs?.coverageScore ?? 0,
        exportCount: spec.exports.length,
        typeCount: spec.types?.length ?? 0,
        showCoverage,
        coverageThreshold,
      };
      const indexDataPath = await createData('index.json', JSON.stringify(indexData));

      // Generate individual export pages data
      const exportPages: Array<{ id: string; path: string }> = [];

      for (const exp of spec.exports) {
        const exportDataPath = await createData(
          `exports/${exp.id}.json`,
          JSON.stringify(formatExport(exp)),
        );

        const pagePath = `${routeBasePath}/${exp.id}`;
        exportPages.push({ id: exp.id, path: pagePath });

        addRoute({
          path: pagePath,
          component: '@theme/DocCovExportPage',
          exact: true,
          modules: {
            exportData: exportDataPath,
          },
        });
      }

      // Create exports list data
      const exportsListPath = await createData(
        'exports-list.json',
        JSON.stringify(
          spec.exports.map((exp) => ({
            id: exp.id,
            name: exp.name,
            kind: exp.kind,
            description: exp.description?.slice(0, 150),
            coverage: exp.docs?.coverageScore ?? 0,
            hasDrift: (exp.docs?.drift?.length ?? 0) > 0,
          })),
        ),
      );

      // Add index route
      addRoute({
        path: routeBasePath,
        component: '@theme/DocCovIndexPage',
        exact: true,
        modules: {
          indexData: indexDataPath,
          exportsList: exportsListPath,
        },
      });
    },

    getThemePath() {
      return path.resolve(__dirname, './theme');
    },
  };
}

function formatExport(exp: SpecExport) {
  return {
    id: exp.id,
    name: exp.name,
    kind: exp.kind,
    description: exp.description,
    examples: exp.examples,
    signatures: exp.signatures,
    members: exp.members,
    typeParameters: exp.typeParameters,
    source: exp.source,
    deprecated: exp.deprecated,
    docs: exp.docs,
    tags: exp.tags,
  };
}

export { docusaurusPluginDocCov };
