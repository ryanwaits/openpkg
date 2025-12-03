import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  detectEntryPoint,
  detectMonorepo,
  DocCov,
  findPackageByName,
  NodeFileSystem,
  typecheckExamples,
  type ExampleTypeError,
} from '@doccov/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';

interface TypecheckCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<TypecheckCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  log: console.log,
  error: console.error,
};

export function registerTypecheckCommand(
  program: Command,
  dependencies: TypecheckCommandDependencies = {},
): void {
  const { createDocCov, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('typecheck [entry]')
    .description('Type-check @example blocks without executing them')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--skip-resolve', 'Skip external type resolution')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry as string | undefined;

        const fileSystem = new NodeFileSystem(options.cwd);

        if (options.package) {
          const mono = await detectMonorepo(fileSystem);
          if (!mono.isMonorepo) {
            throw new Error('Not a monorepo. Remove --package flag.');
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
          log(chalk.gray(`Auto-detected entry point: ${detected.path}`));
        } else {
          entryFile = path.resolve(targetDir, entryFile);
          if (fs.existsSync(entryFile) && fs.statSync(entryFile).isDirectory()) {
            targetDir = entryFile;
            const dirFs = new NodeFileSystem(entryFile);
            const detected = await detectEntryPoint(dirFs);
            entryFile = path.join(entryFile, detected.path);
            log(chalk.gray(`Auto-detected entry point: ${detected.path}`));
          }
        }

        const resolveExternalTypes = !options.skipResolve;

        process.stdout.write(chalk.cyan('> Analyzing documentation...\n'));

        const doccov = createDocCov({ resolveExternalTypes });
        const specResult = await doccov.analyzeFileWithDiagnostics(entryFile);

        if (!specResult) {
          throw new Error('Failed to analyze documentation.');
        }

        // Collect all examples from exports
        const allExamples: Array<{ exportName: string; examples: string[] }> = [];
        for (const exp of specResult.spec.exports ?? []) {
          if (exp.examples && exp.examples.length > 0) {
            allExamples.push({ exportName: exp.name, examples: exp.examples as string[] });
          }
        }

        if (allExamples.length === 0) {
          log(chalk.gray('No @example blocks found'));
          return;
        }

        const totalExamples = allExamples.reduce((sum, e) => sum + e.examples.length, 0);
        process.stdout.write(chalk.cyan(`> Type-checking ${totalExamples} example(s)...\n`));

        // Type-check examples for each export
        const allErrors: Array<{ exportName: string; error: ExampleTypeError }> = [];
        let passed = 0;
        let failed = 0;

        for (const { exportName, examples } of allExamples) {
          const result = typecheckExamples(examples, targetDir);

          for (const err of result.errors) {
            allErrors.push({ exportName, error: err });
          }

          passed += result.passed;
          failed += result.failed;
        }

        // Output results
        if (allErrors.length === 0) {
          log(chalk.green(`✓ All ${totalExamples} example(s) passed type checking`));
          return;
        }

        log('');

        // Group by export
        const byExport = new Map<string, ExampleTypeError[]>();
        for (const { exportName, error: err } of allErrors) {
          const existing = byExport.get(exportName) ?? [];
          existing.push(err);
          byExport.set(exportName, existing);
        }

        for (const [exportName, errors] of byExport) {
          log(chalk.red(`✗ ${exportName}`));
          for (const err of errors) {
            log(
              chalk.gray(`  @example block ${err.exampleIndex + 1}, line ${err.line}:`),
            );
            log(chalk.red(`    ${err.message}`));
          }
          log('');
        }

        log(
          chalk.red(`${failed} example(s) failed`) +
            chalk.gray(`, ${passed} passed`),
        );

        process.exit(1);
      } catch (commandError) {
        error(chalk.red('Error:'), commandError instanceof Error ? commandError.message : commandError);
        process.exit(1);
      }
    });
}

