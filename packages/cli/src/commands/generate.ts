import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DocCov,
  NodeFileSystem,
  resolveTarget,
} from '@doccov/sdk';
import { normalize, type OpenPkg as OpenPkgSpec, validateSpec } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { type LoadedDocCovConfig, loadDocCovConfig } from '../config';
import { computeStats, renderHtml, renderMarkdown } from '../reports';
import {
  type FilterOptions as CliFilterOptions,
  mergeFilterOptions,
  parseListFlag,
} from '../utils/filter-options';

type OutputFormat = 'json' | 'markdown' | 'html';

export interface GenerateCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  writeFileSync?: typeof fs.writeFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<GenerateCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  writeFileSync: fs.writeFileSync,
  log: console.log,
  error: console.error,
};

type GeneratedSpec = Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>>;

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function stripDocsFields(spec: OpenPkgSpec): OpenPkgSpec {
  const { docs: _rootDocs, ...rest } = spec;
  return {
    ...rest,
    exports: spec.exports?.map((exp) => {
      const { docs: _expDocs, ...expRest } = exp;
      return expRest;
    }),
  };
}

function formatDiagnosticOutput(
  prefix: string,
  diagnostic: GeneratedSpec['diagnostics'][number],
  baseDir: string,
): string {
  const location = diagnostic.location;
  const relativePath = location?.file
    ? path.relative(baseDir, location.file) || location.file
    : undefined;
  const locationText =
    location && relativePath
      ? chalk.gray(`${relativePath}:${location.line ?? 1}:${location.column ?? 1}`)
      : null;
  const locationPrefix = locationText ? `${locationText} ` : '';
  return `${prefix} ${locationPrefix}${diagnostic.message}`;
}

export function registerGenerateCommand(
  program: Command,
  dependencies: GenerateCommandDependencies = {},
): void {
  const { createDocCov, writeFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('generate [entry]')
    .description('Generate OpenPkg specification for documentation coverage analysis')
    .option('-o, --output <file>', 'Output file', 'openpkg.json')
    .option('--format <format>', 'Output format: json, markdown, html', 'json')
    .option('-p, --package <name>', 'Target package name (for monorepos)')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--include <ids>', 'Filter exports by identifier (comma-separated or repeated)')
    .option('--exclude <ids>', 'Exclude exports by identifier (comma-separated or repeated)')
    .option('--show-diagnostics', 'Print TypeScript diagnostics from analysis')
    .option('--no-docs', 'Omit docs coverage fields from output (pure structural spec)')
    .option('--limit <n>', 'Max exports to show in report tables (for markdown/html)', '20')
    .option('-y, --yes', 'Skip all prompts and use defaults')
    .action(async (entry, options) => {
      try {
        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { targetDir, entryFile, packageInfo, entryPointInfo } = resolved;

        if (packageInfo) {
          log(chalk.gray(`Found package at ${packageInfo.path}`));
        }
        if (!entry) {
          log(chalk.gray(`Auto-detected entry point: ${entryPointInfo.path} (from ${entryPointInfo.source})`));
        }

        const resolveExternalTypes = !options.skipResolve;

        const cliFilters: CliFilterOptions = {
          include: parseListFlag(options.include),
          exclude: parseListFlag(options.exclude),
        };

        let config: LoadedDocCovConfig | null = null;
        try {
          config = await loadDocCovConfig(targetDir);
          if (config?.filePath) {
            log(
              chalk.gray(`Loaded configuration from ${path.relative(targetDir, config.filePath)}`),
            );
          }
        } catch (configError) {
          error(
            chalk.red('Failed to load DocCov config:'),
            configError instanceof Error ? configError.message : configError,
          );
          process.exit(1);
        }

        const resolvedFilters = mergeFilterOptions(config, cliFilters);
        for (const message of resolvedFilters.messages) {
          log(chalk.gray(`• ${message}`));
        }

        // Use simple text indicator for CPU-intensive analysis (ora can't animate during blocking operations)
        process.stdout.write(chalk.cyan('> Generating OpenPkg spec...\n'));

        let result: GeneratedSpec | undefined;
        try {
          const doccov = createDocCov({
            resolveExternalTypes,
          });
          const analyzeOptions =
            resolvedFilters.include || resolvedFilters.exclude
              ? {
                  filters: {
                    include: resolvedFilters.include,
                    exclude: resolvedFilters.exclude,
                  },
                }
              : {};

          result = await doccov.analyzeFileWithDiagnostics(entryFile, analyzeOptions);
          process.stdout.write(chalk.green('✓ Generated OpenPkg spec\n'));
        } catch (generationError) {
          process.stdout.write(chalk.red('✗ Failed to generate spec\n'));
          throw generationError;
        }

        if (!result) {
          throw new Error('Failed to produce an OpenPkg spec.');
        }

        let normalized = normalize(result.spec as OpenPkgSpec);

        if (options.docs === false) {
          normalized = stripDocsFields(normalized);
        }

        const validation = validateSpec(normalized);

        if (!validation.ok) {
          error(chalk.red('Spec failed schema validation'));
          for (const err of validation.errors) {
            error(chalk.red(`schema: ${err.instancePath || '/'} ${err.message}`));
          }
          process.exit(1);
        }

        const format = (options.format ?? 'json') as OutputFormat;
        const outputPath = path.resolve(process.cwd(), options.output);

        if (format === 'markdown' || format === 'html') {
          // Generate human-readable report
          const stats = computeStats(normalized);
          const limit = parseInt(options.limit, 10) || 20;
          const reportOutput = format === 'html' 
            ? renderHtml(stats, { limit }) 
            : renderMarkdown(stats, { limit });
          
          writeFileSync(outputPath, reportOutput);
          log(chalk.green(`✓ Generated ${format} report: ${options.output}`));
          log(chalk.gray(`  Coverage: ${stats.coverageScore}%`));
          log(chalk.gray(`  ${stats.totalExports} exports, ${stats.driftCount} drift issues`));
        } else {
          // Output JSON spec
          writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
          log(chalk.green(`✓ Generated ${options.output}`));
          log(chalk.gray(`  ${getArrayLength(normalized.exports)} exports`));
          log(chalk.gray(`  ${getArrayLength(normalized.types)} types`));
        }

        if (options.showDiagnostics && result.diagnostics.length > 0) {
          log('');
          log(chalk.bold('Diagnostics'));
          for (const diagnostic of result.diagnostics) {
            const prefix =
              diagnostic.severity === 'error'
                ? chalk.red('✖')
                : diagnostic.severity === 'warning'
                  ? chalk.yellow('⚠')
                  : chalk.cyan('ℹ');
            log(formatDiagnosticOutput(prefix, diagnostic, targetDir));
          }
        }
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exit(1);
      }
    });
}
