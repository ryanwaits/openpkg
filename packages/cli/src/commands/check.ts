import * as path from 'node:path';
import { OpenPkg } from '@openpkg-ts/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora, { type Ora } from 'ora';
import { findEntryPoint, findPackageInMonorepo } from '../utils/package-utils';

interface CheckCommandDependencies {
  createOpenPkg?: (
    options: ConstructorParameters<typeof OpenPkg>[0],
  ) => Pick<OpenPkg, 'analyzeFileWithDiagnostics'>;
  spinner?: (text: string) => Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<CheckCommandDependencies> = {
  createOpenPkg: (options) => new OpenPkg(options),
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

export function registerCheckCommand(
  program: Command,
  dependencies: CheckCommandDependencies = {},
): void {
  const { createOpenPkg, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('check [entry]')
    .description('Fail if documentation coverage falls below a threshold')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--min-coverage <percentage>', 'Minimum docs coverage percentage (0-100)', (value) =>
      Number(value),
    )
    .option('--require-examples', 'Require at least one @example for every export')
    .option('--no-external-types', 'Skip external type resolution from node_modules')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry as string | undefined;

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

        const minCoverage = clampCoverage(options.minCoverage ?? 80);
        const resolveExternalTypes = options.externalTypes !== false;

        const spinnerInstance = spinner('Analyzing documentation coverage...');
        spinnerInstance.start();

        let specResult: Awaited<ReturnType<OpenPkg['analyzeFileWithDiagnostics']>> | undefined;

        try {
          const openpkg = createOpenPkg({ resolveExternalTypes });
          specResult = await openpkg.analyzeFileWithDiagnostics(entryFile);
          spinnerInstance.succeed('Documentation analysis complete');
        } catch (analysisError) {
          spinnerInstance.fail('Failed to analyze documentation coverage');
          throw analysisError;
        }

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }

        const spec = specResult.spec;
        const coverageScore = spec.docs?.coverageScore ?? 0;
        const failingExports = collectFailingExports(spec.exports ?? [], minCoverage);
        const missingExamples = options.requireExamples
          ? failingExports.filter((item) => item.missing?.includes('examples'))
          : [];
        const driftExports = collectDrift(spec.exports ?? []);

        const coverageFailed = coverageScore < minCoverage;
        const hasMissingExamples = missingExamples.length > 0;
        const hasDrift = driftExports.length > 0;

        if (!coverageFailed && !hasMissingExamples && !hasDrift) {
          log(chalk.green(`✓ Docs coverage ${coverageScore}% (min ${minCoverage}%)`));

          if (failingExports.length > 0) {
            log(chalk.gray('Some exports have partial docs:'));
            for (const { name, missing } of failingExports.slice(0, 10)) {
              log(chalk.gray(`  • ${name}: missing ${missing?.join(', ')}`));
            }
          }
          return;
        }

        error('');
        if (coverageFailed) {
          error(chalk.red(`Docs coverage ${coverageScore}% fell below required ${minCoverage}%.`));
        }

        if (hasMissingExamples) {
          error(
            chalk.red(
              `${missingExamples.length} export(s) missing examples (required via --require-examples)`,
            ),
          );
        }

        if (failingExports.length > 0 || driftExports.length > 0) {
          error('');
          error(chalk.bold('Missing documentation details:'));
          for (const { name, missing } of failingExports.slice(0, 10)) {
            error(chalk.red(`  • ${name}: missing ${missing?.join(', ')}`));
          }
          for (const drift of driftExports.slice(0, 10)) {
            error(chalk.red(`  • ${drift.name}: ${drift.issue}`));
            if (drift.suggestion) {
              error(chalk.yellow(`    Suggestion: Did you mean "${drift.suggestion}"?`));
            }
          }
        }

        throw new Error('Documentation coverage requirements not met.');
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        throw commandError instanceof Error ? commandError : new Error(String(commandError));
      }
    });
}

function clampCoverage(value: number): number {
  if (Number.isNaN(value)) {
    return 80;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function collectFailingExports(
  exportsList: Array<{
    name: string;
    docs?: { coverageScore?: number; missing?: string[]; drift?: Array<{ message: string }> };
  }>,
  minCoverage: number,
): Array<{ name: string; missing?: string[] }> {
  const offenders: Array<{ name: string; missing?: string[] }> = [];

  for (const entry of exportsList) {
    const exportScore = entry.docs?.coverageScore ?? 0;
    const missing = entry.docs?.missing;
    if (exportScore < minCoverage || (missing && missing.length > 0)) {
      offenders.push({
        name: entry.name,
        missing,
      });
    }
  }

  return offenders;
}

function collectDrift(
  exportsList: Array<{
    name: string;
    docs?: { drift?: Array<{ issue?: string; suggestion?: string }> };
  }>,
): Array<{ name: string; issue: string; suggestion?: string }> {
  const drifts: Array<{ name: string; issue: string; suggestion?: string }> = [];
  for (const entry of exportsList) {
    const drift = entry.docs?.drift;
    if (!drift || drift.length === 0) {
      continue;
    }

    for (const signal of drift) {
      drifts.push({
        name: entry.name,
        issue: signal.issue ?? 'Documentation drift detected.',
        suggestion: signal.suggestion,
      });
    }
  }
  return drifts;
}
