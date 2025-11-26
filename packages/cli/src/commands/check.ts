import * as fs from 'node:fs';
import * as path from 'node:path';
import { DocCov, detectExampleRuntimeErrors, runExamples } from '@doccov/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora, { type Ora } from 'ora';
import { findEntryPoint, findPackageInMonorepo } from '../utils/package-utils';

interface CheckCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  spinner?: (text: string) => Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<CheckCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

export function registerCheckCommand(
  program: Command,
  dependencies: CheckCommandDependencies = {},
): void {
  const { createDocCov, spinner, log, error } = {
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
    .option('--run-examples', 'Execute @example blocks and fail on runtime errors')
    .option('--ignore-drift', 'Do not fail on documentation drift')
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
          // If path is a directory, find entry point within it
          if (fs.existsSync(entryFile) && fs.statSync(entryFile).isDirectory()) {
            entryFile = await findEntryPoint(entryFile, true);
            log(chalk.gray(`Auto-detected entry point: ${entryFile}`));
          }
        }

        const minCoverage = clampCoverage(options.minCoverage ?? 80);
        const resolveExternalTypes = options.externalTypes !== false;

        const spinnerInstance = spinner('Analyzing documentation coverage...');
        spinnerInstance.start();

        let specResult: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>> | undefined;

        try {
          const doccov = createDocCov({ resolveExternalTypes });
          specResult = await doccov.analyzeFileWithDiagnostics(entryFile);
          spinnerInstance.succeed('Documentation analysis complete');
        } catch (analysisError) {
          spinnerInstance.fail('Failed to analyze documentation coverage');
          throw analysisError;
        }

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }

        const spec = specResult.spec;

        // Run examples if --run-examples flag is set
        const runtimeDrifts: Array<{ name: string; issue: string; suggestion?: string }> = [];
        if (options.runExamples) {
          const examplesSpinner = spinner('Running @example blocks...');
          examplesSpinner.start();

          let examplesRun = 0;
          let examplesFailed = 0;

          for (const entry of spec.exports ?? []) {
            if (!entry.examples || entry.examples.length === 0) {
              continue;
            }

            const results = await runExamples(entry.examples, {
              timeout: 5000,
              cwd: targetDir,
            });

            examplesRun += results.size;

            // Detect runtime errors
            const entryDrifts = detectExampleRuntimeErrors(entry, results);
            for (const drift of entryDrifts) {
              examplesFailed += 1;
              runtimeDrifts.push({
                name: entry.name,
                issue: drift.issue,
                suggestion: drift.suggestion,
              });
            }
          }

          if (examplesFailed > 0) {
            examplesSpinner.fail(`${examplesFailed}/${examplesRun} example(s) failed`);
          } else {
            examplesSpinner.succeed(`${examplesRun} example(s) passed`);
          }
        }

        const coverageScore = spec.docs?.coverageScore ?? 0;
        const failingExports = collectFailingExports(spec.exports ?? [], minCoverage);
        const missingExamples = options.requireExamples
          ? failingExports.filter((item) => item.missing?.includes('examples'))
          : [];
        const driftExports = [...collectDrift(spec.exports ?? []), ...runtimeDrifts];

        const coverageFailed = coverageScore < minCoverage;
        const hasMissingExamples = missingExamples.length > 0;
        const hasDrift = !options.ignoreDrift && driftExports.length > 0;

        if (!coverageFailed && !hasMissingExamples && !hasDrift) {
          log(chalk.green(`✓ Docs coverage ${coverageScore}% (min ${minCoverage}%)`));

          if (failingExports.length > 0) {
            log(chalk.gray('Some exports have partial docs:'));
            for (const { name, missing } of failingExports.slice(0, 10)) {
              log(chalk.gray(`  • ${name}: missing ${missing?.join(', ')}`));
            }
          }

          if (options.ignoreDrift && driftExports.length > 0) {
            log('');
            log(chalk.yellow(`⚠️ ${driftExports.length} drift issue(s) detected (ignored):`));
            for (const drift of driftExports.slice(0, 10)) {
              log(chalk.yellow(`  • ${drift.name}: ${drift.issue}`));
              if (drift.suggestion) {
                log(chalk.gray(`    Suggestion: ${drift.suggestion}`));
              }
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
              error(chalk.yellow(`    Suggestion: ${drift.suggestion}`));
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
