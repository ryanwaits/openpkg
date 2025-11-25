import * as fs from 'node:fs';
import * as path from 'node:path';
import { diffSpec, type OpenPkg, type SpecDiff } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';

export interface DiffCommandDependencies {
  readFileSync?: typeof fs.readFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<DiffCommandDependencies> = {
  readFileSync: fs.readFileSync,
  log: console.log,
  error: console.error,
};

type OutputFormat = 'json' | 'text';

export function registerDiffCommand(
  program: Command,
  dependencies: DiffCommandDependencies = {},
): void {
  const { readFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('diff <base> <head>')
    .description('Compare two OpenPkg specs and report coverage delta')
    .option('--output <format>', 'Output format: json or text', 'text')
    .option('--fail-on-regression', 'Exit with error if coverage regressed')
    .option('--fail-on-drift', 'Exit with error if new drift was introduced')
    .action((base: string, head: string, options) => {
      try {
        const baseSpec = loadSpec(base, readFileSync);
        const headSpec = loadSpec(head, readFileSync);

        const diff = diffSpec(baseSpec, headSpec);
        const format = (options.output as OutputFormat) ?? 'text';

        if (format === 'json') {
          log(JSON.stringify(diff, null, 2));
        } else {
          printTextDiff(diff, log, error);
        }

        // Check failure conditions
        if (options.failOnRegression && diff.coverageDelta < 0) {
          error(chalk.red(`\nCoverage regressed by ${Math.abs(diff.coverageDelta)}%`));
          process.exitCode = 1;
          return;
        }

        if (options.failOnDrift && diff.driftIntroduced > 0) {
          error(chalk.red(`\n${diff.driftIntroduced} new drift issue(s) introduced`));
          process.exitCode = 1;
          return;
        }
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exitCode = 1;
      }
    });
}

function loadSpec(filePath: string, readFileSync: typeof fs.readFileSync): OpenPkg {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(content) as OpenPkg;
  } catch (parseError) {
    throw new Error(
      `Failed to parse ${filePath}: ${parseError instanceof Error ? parseError.message : parseError}`,
    );
  }
}

function printTextDiff(diff: SpecDiff, log: typeof console.log, error: typeof console.error): void {
  log('');
  log(chalk.bold('DocCov Diff Report'));
  log('─'.repeat(40));

  // Coverage summary
  const coverageColor =
    diff.coverageDelta > 0 ? chalk.green : diff.coverageDelta < 0 ? chalk.red : chalk.gray;
  const coverageSymbol = diff.coverageDelta > 0 ? '↑' : diff.coverageDelta < 0 ? '↓' : '→';
  const deltaStr = diff.coverageDelta > 0 ? `+${diff.coverageDelta}` : String(diff.coverageDelta);

  log('');
  log(chalk.bold('Coverage'));
  log(
    `  ${diff.oldCoverage}% ${coverageSymbol} ${diff.newCoverage}% ${coverageColor(`(${deltaStr}%)`)}`,
  );

  // Structural changes
  if (diff.breaking.length > 0 || diff.nonBreaking.length > 0) {
    log('');
    log(chalk.bold('API Changes'));
    if (diff.breaking.length > 0) {
      log(chalk.red(`  ${diff.breaking.length} breaking change(s)`));
      for (const id of diff.breaking.slice(0, 5)) {
        log(chalk.red(`    - ${id}`));
      }
      if (diff.breaking.length > 5) {
        log(chalk.gray(`    ... and ${diff.breaking.length - 5} more`));
      }
    }
    if (diff.nonBreaking.length > 0) {
      log(chalk.green(`  ${diff.nonBreaking.length} new export(s)`));
      for (const id of diff.nonBreaking.slice(0, 5)) {
        log(chalk.green(`    + ${id}`));
      }
      if (diff.nonBreaking.length > 5) {
        log(chalk.gray(`    ... and ${diff.nonBreaking.length - 5} more`));
      }
    }
  }

  // Docs health
  log('');
  log(chalk.bold('Docs Health'));

  if (diff.newUndocumented.length > 0) {
    log(chalk.yellow(`  ${diff.newUndocumented.length} new undocumented export(s)`));
    for (const id of diff.newUndocumented.slice(0, 5)) {
      log(chalk.yellow(`    ! ${id}`));
    }
    if (diff.newUndocumented.length > 5) {
      log(chalk.gray(`    ... and ${diff.newUndocumented.length - 5} more`));
    }
  }

  if (diff.improvedExports.length > 0) {
    log(chalk.green(`  ${diff.improvedExports.length} export(s) improved docs`));
  }

  if (diff.regressedExports.length > 0) {
    log(chalk.red(`  ${diff.regressedExports.length} export(s) regressed docs`));
    for (const id of diff.regressedExports.slice(0, 5)) {
      log(chalk.red(`    ↓ ${id}`));
    }
  }

  // Drift summary
  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    log('');
    log(chalk.bold('Drift'));
    if (diff.driftIntroduced > 0) {
      log(chalk.red(`  +${diff.driftIntroduced} new drift issue(s)`));
    }
    if (diff.driftResolved > 0) {
      log(chalk.green(`  -${diff.driftResolved} drift issue(s) resolved`));
    }
  }

  log('');
}
