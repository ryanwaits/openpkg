import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { OpenPkg } from 'openpkg-sdk';
import ora, { type Ora } from 'ora';
import { type LoadedOpenPkgConfig, loadOpenPkgConfig } from '../config';
import {
  type FilterOptions as CliFilterOptions,
  mergeFilterOptions,
  parseListFlag,
} from '../utils/filter-options';
import { findEntryPoint, findPackageInMonorepo } from '../utils/package-utils';

export interface GenerateCommandDependencies {
  createOpenPkg?: (
    options: ConstructorParameters<typeof OpenPkg>[0],
  ) => Pick<OpenPkg, 'analyzeFileWithDiagnostics'>;
  writeFileSync?: typeof fs.writeFileSync;
  spinner?: (text: string) => Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<GenerateCommandDependencies> = {
  createOpenPkg: (options) => new OpenPkg(options),
  writeFileSync: fs.writeFileSync,
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

type GeneratedSpec = Awaited<ReturnType<OpenPkg['analyzeFileWithDiagnostics']>>;

type SpecSummary = {
  exports?: unknown[];
  types?: unknown[];
};

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function registerGenerateCommand(
  program: Command,
  dependencies: GenerateCommandDependencies = {},
): void {
  const { createOpenPkg, writeFileSync, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('generate [entry]')
    .description('Generate OpenPkg specification')
    .option('-o, --output <file>', 'Output file', 'openpkg.json')
    .option('-p, --package <name>', 'Target package name (for monorepos)')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--no-external-types', 'Skip external type resolution from node_modules')
    .option('--include <ids>', 'Filter exports by identifier (comma-separated or repeated)')
    .option('--exclude <ids>', 'Exclude exports by identifier (comma-separated or repeated)')
    .option('-y, --yes', 'Skip all prompts and use defaults')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry;

        if (options.package) {
          const packageDir = await findPackageInMonorepo(options.cwd, options.package);
          if (!packageDir) {
            throw new Error(`Package "${options.package}" not found in monorepo`);
          }
          targetDir = packageDir;
          log(chalk.gray(`Found package at ${path.relative(options.cwd, packageDir)}`));
        }

        if (!entryFile) {
          entryFile = await findEntryPoint(targetDir, true);
          log(chalk.gray(`Auto-detected entry point: ${path.relative(targetDir, entryFile)}`));
        } else {
          entryFile = path.resolve(targetDir, entryFile);
        }

        const resolveExternalTypes = options.externalTypes !== false;

        const cliFilters: CliFilterOptions = {
          include: parseListFlag(options.include),
          exclude: parseListFlag(options.exclude),
        };

        let config: LoadedOpenPkgConfig | null = null;
        try {
          config = await loadOpenPkgConfig(targetDir);
          if (config?.filePath) {
            log(
              chalk.gray(`Loaded configuration from ${path.relative(targetDir, config.filePath)}`),
            );
          }
        } catch (configError) {
          error(
            chalk.red('Failed to load OpenPkg config:'),
            configError instanceof Error ? configError.message : configError,
          );
          process.exit(1);
        }

        const resolvedFilters = mergeFilterOptions(config, cliFilters);
        for (const message of resolvedFilters.messages) {
          log(chalk.gray(`• ${message}`));
        }

        const spinnerInstance = spinner('Generating OpenPkg spec...');
        spinnerInstance.start();

        let result: GeneratedSpec | undefined;
        try {
          const openpkg = createOpenPkg({
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

          result = await openpkg.analyzeFileWithDiagnostics(entryFile, analyzeOptions);
          spinnerInstance.succeed('Generated OpenPkg spec');
        } catch (generationError) {
          spinnerInstance.fail('Failed to generate spec');
          throw generationError;
        }

        if (!result) {
          throw new Error('Failed to produce an OpenPkg spec.');
        }

        const outputPath = path.resolve(targetDir, options.output);
        writeFileSync(outputPath, JSON.stringify(result.spec, null, 2));

        log(chalk.green(`✓ Generated ${path.relative(process.cwd(), outputPath)}`));
        const summary = result.spec as SpecSummary;
        log(chalk.gray(`  ${getArrayLength(summary.exports)} exports`));
        log(chalk.gray(`  ${getArrayLength(summary.types)} types`));

        if (result.diagnostics.length > 0) {
          log('');
          log(chalk.bold('Diagnostics'));
          for (const diagnostic of result.diagnostics) {
            const prefix =
              diagnostic.severity === 'error'
                ? chalk.red('✖')
                : diagnostic.severity === 'warning'
                  ? chalk.yellow('⚠')
                  : chalk.cyan('ℹ');
            log(`${prefix} ${diagnostic.message}`);
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
