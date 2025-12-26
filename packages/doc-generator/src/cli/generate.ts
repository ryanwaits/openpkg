import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { createDocs } from '../core/loader';
import { toJSONString } from '../render/json';
import { exportToMarkdown } from '../render/markdown';
import { toDocusaurusSidebarJS, toFumadocsMetaJSON, toNavigation } from '../render/nav';

export type GenerateFormat = 'mdx' | 'json';
export type NavFormat = 'fumadocs' | 'docusaurus' | 'generic';
export type GroupBy = 'kind' | 'module' | 'tag' | 'none';

export interface GenerateOptions {
  out: string;
  format: GenerateFormat;
  nav?: NavFormat;
  flat?: boolean;
  groupBy?: GroupBy;
  basePath?: string;
  verbose?: boolean;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate <spec>')
    .description('Generate MDX or JSON files from OpenPkg spec')
    .option('-o, --out <dir>', 'Output directory', './api-docs')
    .option('-f, --format <format>', 'Output format: mdx or json', 'mdx')
    .option('--nav <format>', 'Navigation format: fumadocs, docusaurus, generic')
    .option('--flat', 'Flat file structure (no grouping folders)')
    .option('--group-by <groupBy>', 'Group by: kind, module, tag, none', 'kind')
    .option('--base-path <path>', 'Base path for navigation links', '/api')
    .option('--verbose', 'Verbose output')
    .action(async (specPath: string, options: GenerateOptions) => {
      try {
        const resolvedSpec = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpec)) {
          console.error(`Error: Spec file not found: ${resolvedSpec}`);
          process.exit(1);
        }

        const docs = createDocs(resolvedSpec);
        const exports = docs.getAllExports();
        const outDir = path.resolve(options.out);

        if (options.verbose) {
          console.log(`Spec: ${resolvedSpec}`);
          console.log(`Output: ${outDir}`);
          console.log(`Format: ${options.format}`);
          console.log(`Exports: ${exports.length}`);
        }

        // Create output directory
        fs.mkdirSync(outDir, { recursive: true });

        if (options.format === 'json') {
          // Single JSON file output
          const jsonContent = toJSONString(docs.spec, { pretty: true });
          const jsonPath = path.join(outDir, 'api.json');
          fs.writeFileSync(jsonPath, jsonContent);
          console.log(`Generated ${jsonPath}`);
        } else {
          // MDX files output
          const groupBy = options.groupBy ?? 'kind';
          const isFlat = options.flat ?? false;

          // Group exports for folder structure
          const groups = new Map<string, typeof exports>();

          for (const exp of exports) {
            let groupKey: string;

            if (isFlat || groupBy === 'none') {
              groupKey = '';
            } else if (groupBy === 'kind') {
              groupKey = `${exp.kind}s`; // functions, classes, etc.
            } else if (groupBy === 'module') {
              groupKey = extractModule(exp.source?.file) || 'core';
            } else if (groupBy === 'tag') {
              const categoryTag = exp.tags?.find(
                (t) => t.name === 'category' || t.name === '@category',
              );
              groupKey = categoryTag?.text || 'other';
            } else {
              groupKey = '';
            }

            const existing = groups.get(groupKey) ?? [];
            existing.push(exp);
            groups.set(groupKey, existing);
          }

          let fileCount = 0;

          // Generate files
          for (const [group, groupExports] of groups) {
            const groupDir = group ? path.join(outDir, slugify(group)) : outDir;

            if (group) {
              fs.mkdirSync(groupDir, { recursive: true });
            }

            for (const exp of groupExports) {
              const mdx = exportToMarkdown(exp, {
                frontmatter: true,
                codeSignatures: true,
              });

              const filename = `${slugify(exp.name)}.mdx`;
              const filePath = path.join(groupDir, filename);
              fs.writeFileSync(filePath, mdx);
              fileCount++;

              if (options.verbose) {
                console.log(`  ${group ? `${group}/` : ''}${filename}`);
              }
            }
          }

          console.log(`Generated ${fileCount} MDX files in ${outDir}`);
        }

        // Generate navigation file if requested
        if (options.nav) {
          const basePath = options.basePath ?? '/api';
          const navOptions = {
            format: options.nav,
            groupBy: (options.groupBy ?? 'kind') as GroupBy,
            basePath,
          };

          let navContent: string;
          let navFilename: string;

          switch (options.nav) {
            case 'fumadocs':
              navContent = toFumadocsMetaJSON(docs.spec, navOptions);
              navFilename = 'meta.json';
              break;
            case 'docusaurus':
              navContent = toDocusaurusSidebarJS(docs.spec, navOptions);
              navFilename = 'sidebars.js';
              break;
            default:
              navContent = JSON.stringify(toNavigation(docs.spec, navOptions), null, 2);
              navFilename = 'nav.json';
              break;
          }

          const navPath = path.join(outDir, navFilename);
          fs.writeFileSync(navPath, navContent);
          console.log(`Generated ${navPath}`);
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}

function extractModule(filePath?: string): string | undefined {
  if (!filePath) return undefined;

  const parts = filePath.split('/');
  const lastPart = parts[parts.length - 1];

  if (lastPart === 'index.ts' || lastPart === 'index.tsx') {
    return parts[parts.length - 2];
  }

  return lastPart.replace(/\.[jt]sx?$/, '');
}
