import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DocCov,
  detectEntryPoint,
  detectMonorepo,
  findPackageByName,
  NodeFileSystem,
} from '@doccov/sdk';
import { normalize, type OpenPkg as OpenPkgSpec, validateSpec } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { type LoadedDocCovConfig, loadDocCovConfig } from '../config';
import {
  type FilterOptions as CliFilterOptions,
  mergeFilterOptions,
  parseListFlag,
} from '../utils/filter-options';

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
    .option('-p, --package <name>', 'Target package name (for monorepos)')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--include <ids>', 'Filter exports by identifier (comma-separated or repeated)')
    .option('--exclude <ids>', 'Exclude exports by identifier (comma-separated or repeated)')
    .option('--show-diagnostics', 'Print TypeScript diagnostics from analysis')
    .option('--no-docs', 'Omit docs coverage fields from output (pure structural spec)')
    .option('-y, --yes', 'Skip all prompts and use defaults')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry;

        // Create filesystem abstraction for detection
        const fileSystem = new NodeFileSystem(options.cwd);

        if (options.package) {
          const mono = await detectMonorepo(fileSystem);
          if (!mono.isMonorepo) {
            throw new Error(`Not a monorepo. Remove --package flag for single-package repos.`);
          }
          const pkg = findPackageByName(mono.packages, options.package);
          if (!pkg) {
            const available = mono.packages.map((p) => p.name).join(', ');
            throw new Error(`Package "${options.package}" not found. Available: ${available}`);
          }
          targetDir = path.join(options.cwd, pkg.path);
          log(chalk.gray(`Found package at ${pkg.path}`));
        }

        if (!entryFile) {
          const targetFs = new NodeFileSystem(targetDir);
          const detected = await detectEntryPoint(targetFs);
          entryFile = path.join(targetDir, detected.path);
          log(chalk.gray(`Auto-detected entry point: ${detected.path} (from ${detected.source})`));
        } else {
          entryFile = path.resolve(targetDir, entryFile);
          // If path is a directory, find entry point within it
          if (fs.existsSync(entryFile) && fs.statSync(entryFile).isDirectory()) {
            const dirFs = new NodeFileSystem(entryFile);
            const detected = await detectEntryPoint(dirFs);
            entryFile = path.join(entryFile, detected.path);
            log(
              chalk.gray(`Auto-detected entry point: ${detected.path} (from ${detected.source})`),
            );
          }
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

        const outputPath = path.resolve(process.cwd(), options.output);
        let normalized = normalize(result.spec as OpenPkgSpec);

        if (options.docs === false) {
          normalized = stripDocsFields(normalized);
        }

        const validation = validateSpec(normalized);

        if (!validation.ok) {
          spinnerInstance.fail('Spec failed schema validation');
          for (const err of validation.errors) {
            error(chalk.red(`schema: ${err.instancePath || '/'} ${err.message}`));
          }
          process.exit(1);
        }

        writeFileSync(outputPath, JSON.stringify(normalized, null, 2));

        log(chalk.green(`✓ Generated ${options.output}`));
        log(chalk.gray(`  ${getArrayLength(normalized.exports)} exports`));
        log(chalk.gray(`  ${getArrayLength(normalized.types)} types`));

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
