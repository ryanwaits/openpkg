import * as fs from 'node:fs';
import * as path from 'node:path';
import { DocCov, type GenerationInput, NodeFileSystem, resolveTarget } from '@doccov/sdk';
import { normalize, type OpenPkg as OpenPkgSpec, validateSpec } from '@openpkg-ts/spec';
import { version as cliVersion } from '../../package.json';
import chalk from 'chalk';
import type { Command } from 'commander';
import { type LoadedDocCovConfig, loadDocCovConfig } from '../config';
import {
  type FilterOptions as CliFilterOptions,
  mergeFilterOptions,
  parseListFlag,
} from '../utils/filter-options';

export interface SpecOptions {
  // Core options
  cwd: string;
  package?: string;

  // Output
  output: string;

  // Filtering
  include?: string;
  exclude?: string;

  // Type resolution
  skipResolve?: boolean;
  maxTypeDepth?: string;

  // Caching
  cache?: boolean;

  // Diagnostics
  showDiagnostics?: boolean;

  // Verbose output
  verbose?: boolean;
}

export interface SpecCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  writeFileSync?: typeof fs.writeFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<SpecCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  writeFileSync: fs.writeFileSync,
  log: console.log,
  error: console.error,
};

type GeneratedSpec = Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>>;

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
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

export function registerSpecCommand(
  program: Command,
  dependencies: SpecCommandDependencies = {},
): void {
  const { createDocCov, writeFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('spec [entry]')
    .description('Generate OpenPkg specification (JSON)')

    // === Core options ===
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('-p, --package <name>', 'Target package name (for monorepos)')

    // === Output ===
    .option('-o, --output <file>', 'Output file path', 'openpkg.json')

    // === Filtering ===
    .option('--include <patterns>', 'Include exports matching pattern (comma-separated)')
    .option('--exclude <patterns>', 'Exclude exports matching pattern (comma-separated)')

    // === Type resolution ===
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--max-type-depth <n>', 'Maximum depth for type conversion', '20')

    // === Caching ===
    .option('--no-cache', 'Bypass spec cache and force regeneration')

    // === Diagnostics ===
    .option('--show-diagnostics', 'Show TypeScript compiler diagnostics')

    // === Verbose ===
    .option('--verbose', 'Show detailed generation metadata')

    .action(async (entry: string | undefined, options: SpecOptions) => {
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
          log(
            chalk.gray(
              `Auto-detected entry point: ${entryPointInfo.path} (from ${entryPointInfo.source})`,
            ),
          );
        }

        // Load config
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

        // Merge filter options
        const cliFilters: CliFilterOptions = {
          include: parseListFlag(options.include),
          exclude: parseListFlag(options.exclude),
        };
        const resolvedFilters = mergeFilterOptions(config, cliFilters);
        for (const message of resolvedFilters.messages) {
          log(chalk.gray(`${message}`));
        }

        const resolveExternalTypes = !options.skipResolve;

        // Run analysis
        process.stdout.write(chalk.cyan('> Generating OpenPkg spec...\n'));

        let result: GeneratedSpec | undefined;
        try {
          const doccov = createDocCov({
            resolveExternalTypes,
            maxDepth: options.maxTypeDepth ? parseInt(options.maxTypeDepth, 10) : undefined,
            useCache: options.cache !== false,
            cwd: options.cwd,
          });

          // Build generation input for spec metadata
          const generationInput: GenerationInput = {
            entryPoint: path.relative(targetDir, entryFile),
            entryPointSource: entryPointInfo.source,
            isDeclarationOnly: entryPointInfo.isDeclarationOnly ?? false,
            generatorName: '@doccov/cli',
            generatorVersion: cliVersion,
            packageManager: packageInfo?.packageManager,
            isMonorepo: resolved.isMonorepo,
            targetPackage: packageInfo?.name,
          };

          const analyzeOptions =
            resolvedFilters.include || resolvedFilters.exclude
              ? {
                  filters: {
                    include: resolvedFilters.include,
                    exclude: resolvedFilters.exclude,
                  },
                  generationInput,
                }
              : { generationInput };

          result = await doccov.analyzeFileWithDiagnostics(entryFile, analyzeOptions);

          if (result.fromCache) {
            process.stdout.write(chalk.gray('> Using cached spec\n'));
          } else {
            process.stdout.write(chalk.green('> Generated OpenPkg spec\n'));
          }
        } catch (generationError) {
          process.stdout.write(chalk.red('> Failed to generate spec\n'));
          throw generationError;
        }

        if (!result) {
          throw new Error('Failed to produce an OpenPkg spec.');
        }

        // Normalize and validate
        const normalized = normalize(result.spec as OpenPkgSpec);
        const validation = validateSpec(normalized);

        if (!validation.ok) {
          error(chalk.red('Spec failed schema validation'));
          for (const err of validation.errors) {
            error(chalk.red(`schema: ${err.instancePath || '/'} ${err.message}`));
          }
          process.exit(1);
        }

        // Write output
        const outputPath = path.resolve(process.cwd(), options.output);
        writeFileSync(outputPath, JSON.stringify(normalized, null, 2));

        log(chalk.green(`> Wrote ${options.output}`));
        log(chalk.gray(`  ${getArrayLength(normalized.exports)} exports`));
        log(chalk.gray(`  ${getArrayLength(normalized.types)} types`));

        // Show verbose generation metadata if requested
        if (options.verbose && normalized.generation) {
          const gen = normalized.generation;
          log('');
          log(chalk.bold('Generation Info'));
          log(chalk.gray(`  Timestamp:        ${gen.timestamp}`));
          log(chalk.gray(`  Generator:        ${gen.generator.name}@${gen.generator.version}`));
          log(chalk.gray(`  Entry point:      ${gen.analysis.entryPoint}`));
          log(chalk.gray(`  Detected via:     ${gen.analysis.entryPointSource}`));
          log(
            chalk.gray(
              `  Declaration only: ${gen.analysis.isDeclarationOnly ? 'yes' : 'no'}`,
            ),
          );
          log(
            chalk.gray(
              `  External types:   ${gen.analysis.resolvedExternalTypes ? 'resolved' : 'skipped'}`,
            ),
          );
          if (gen.analysis.maxTypeDepth) {
            log(chalk.gray(`  Max type depth:   ${gen.analysis.maxTypeDepth}`));
          }
          log('');
          log(chalk.bold('Environment'));
          log(chalk.gray(`  node_modules:     ${gen.environment.hasNodeModules ? 'found' : 'not found'}`));
          if (gen.environment.packageManager) {
            log(chalk.gray(`  Package manager:  ${gen.environment.packageManager}`));
          }
          if (gen.environment.isMonorepo) {
            log(chalk.gray(`  Monorepo:         yes`));
          }
          if (gen.environment.targetPackage) {
            log(chalk.gray(`  Target package:   ${gen.environment.targetPackage}`));
          }

          if (gen.issues.length > 0) {
            log('');
            log(chalk.bold('Issues'));
            for (const issue of gen.issues) {
              const prefix =
                issue.severity === 'error'
                  ? chalk.red('>')
                  : issue.severity === 'warning'
                    ? chalk.yellow('>')
                    : chalk.cyan('>');
              log(`${prefix} [${issue.code}] ${issue.message}`);
              if (issue.suggestion) {
                log(chalk.gray(`    ${issue.suggestion}`));
              }
            }
          }
        }

        // Show diagnostics if requested
        if (options.showDiagnostics && result.diagnostics.length > 0) {
          log('');
          log(chalk.bold('Diagnostics'));
          for (const diagnostic of result.diagnostics) {
            const prefix =
              diagnostic.severity === 'error'
                ? chalk.red('>')
                : diagnostic.severity === 'warning'
                  ? chalk.yellow('>')
                  : chalk.cyan('>');
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
