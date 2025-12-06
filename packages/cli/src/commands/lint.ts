import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  createSourceFile,
  DocCov,
  findJSDocLocation,
  getDefaultConfig,
  getRule,
  type JSDocEdit,
  type LintConfig,
  type LintSeverity,
  type LintViolation,
  lintExport,
  NodeFileSystem,
  resolveTarget,
  serializeJSDoc,
} from '@doccov/sdk';
import type { SpecExport } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';

interface LintCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<LintCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  log: console.log,
  error: console.error,
};

interface ExportWithJSDoc {
  export: SpecExport;
  rawJSDoc?: string;
  filePath?: string;
}

/**
 * Get raw JSDoc for an export from source file
 */
function getRawJSDoc(exp: SpecExport, targetDir: string): string | undefined {
  if (!exp.source?.file) return undefined;

  const filePath = path.resolve(targetDir, exp.source.file);
  if (!fs.existsSync(filePath)) return undefined;

  try {
    const sourceFile = createSourceFile(filePath);
    const location = findJSDocLocation(sourceFile, exp.name, exp.source.line);
    return location?.existingJSDoc;
  } catch {
    return undefined;
  }
}

export function registerLintCommand(
  program: Command,
  dependencies: LintCommandDependencies = {},
): void {
  const { createDocCov, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('lint [entry]')
    .description('Lint documentation for style and quality issues')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--fix', 'Auto-fix fixable issues')
    .option('--write', 'Alias for --fix')
    .option('--rule <name>', 'Run only a specific rule')
    .option('--skip-resolve', 'Skip external type resolution')
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
          log(chalk.gray(`Auto-detected entry point: ${entryPointInfo.path}`));
        }

        const resolveExternalTypes = !options.skipResolve;

        process.stdout.write(chalk.cyan('> Analyzing documentation...\n'));

        const doccov = createDocCov({ resolveExternalTypes });
        const specResult = await doccov.analyzeFileWithDiagnostics(entryFile);

        if (!specResult) {
          throw new Error('Failed to analyze documentation.');
        }

        process.stdout.write(chalk.cyan('> Running lint rules...\n'));

        // Build lint config
        let config: LintConfig = getDefaultConfig();

        // If specific rule requested, disable all others
        if (options.rule) {
          const rule = getRule(options.rule);
          if (!rule) {
            throw new Error(`Unknown rule: ${options.rule}`);
          }
          const rules: Record<string, LintSeverity> = {};
          for (const key of Object.keys(config.rules)) {
            rules[key] = 'off';
          }
          rules[options.rule] = rule.defaultSeverity === 'off' ? 'warn' : rule.defaultSeverity;
          config = { rules };
        }

        // Collect exports with raw JSDoc
        const exportsWithJSDoc: ExportWithJSDoc[] = [];
        for (const exp of specResult.spec.exports ?? []) {
          const rawJSDoc = getRawJSDoc(exp, targetDir);
          exportsWithJSDoc.push({
            export: exp,
            rawJSDoc,
            filePath: exp.source?.file ? path.resolve(targetDir, exp.source.file) : undefined,
          });
        }

        // Run lint
        const allViolations: Array<{
          export: SpecExport;
          violation: LintViolation;
          filePath?: string;
          rawJSDoc?: string;
        }> = [];

        for (const { export: exp, rawJSDoc, filePath } of exportsWithJSDoc) {
          const violations = lintExport(exp, rawJSDoc, config);
          for (const violation of violations) {
            allViolations.push({ export: exp, violation, filePath, rawJSDoc });
          }
        }

        // Handle --fix / --write
        const shouldFix = options.fix || options.write;
        const fixableViolations = allViolations.filter((v) => v.violation.fixable);

        if (shouldFix && fixableViolations.length > 0) {
          process.stdout.write(chalk.cyan('> Applying fixes...\n'));

          const edits: JSDocEdit[] = [];

          for (const { export: exp, rawJSDoc, filePath } of fixableViolations) {
            if (!filePath || !rawJSDoc) continue;
            if (filePath.endsWith('.d.ts')) continue;

            const sourceFile = createSourceFile(filePath);
            const location = findJSDocLocation(sourceFile, exp.name, exp.source?.line);
            if (!location) continue;

            // Get the rule and apply fix
            const rule = getRule('consistent-param-style');
            if (!rule?.fix) continue;

            const patch = rule.fix(exp, rawJSDoc);
            if (!patch) continue;

            const newJSDoc = serializeJSDoc(patch, location.indent);

            edits.push({
              filePath,
              symbolName: exp.name,
              startLine: location.startLine,
              endLine: location.endLine,
              hasExisting: location.hasExisting,
              existingJSDoc: location.existingJSDoc,
              newJSDoc,
              indent: location.indent,
            });
          }

          if (edits.length > 0) {
            const result = await applyEdits(edits);
            if (result.errors.length > 0) {
              for (const err of result.errors) {
                error(chalk.red(`  ${err.file}: ${err.error}`));
              }
            } else {
              process.stdout.write(
                chalk.green(
                  `✓ Fixed ${result.editsApplied} issue(s) in ${result.filesModified} file(s)\n`,
                ),
              );
            }

            // Remove fixed violations from output
            const fixedExports = new Set(edits.map((e) => e.symbolName));
            const remaining = allViolations.filter(
              (v) => !v.violation.fixable || !fixedExports.has(v.export.name),
            );
            allViolations.length = 0;
            allViolations.push(...remaining);
          }
        }

        // Output results
        if (allViolations.length === 0) {
          log(chalk.green('✓ No lint issues found'));
          return;
        }

        // Group by file
        const byFile = new Map<string, typeof allViolations>();
        for (const v of allViolations) {
          const file = v.filePath ?? 'unknown';
          const existing = byFile.get(file) ?? [];
          existing.push(v);
          byFile.set(file, existing);
        }

        log('');
        for (const [filePath, violations] of byFile) {
          const relativePath = path.relative(targetDir, filePath);
          log(chalk.underline(relativePath));

          for (const { export: exp, violation } of violations) {
            const line = exp.source?.line ?? 0;
            const severity =
              violation.severity === 'error' ? chalk.red('error') : chalk.yellow('warning');
            const fixable = violation.fixable ? chalk.gray(' (fixable)') : '';
            log(
              `  ${line}:1  ${severity}  ${violation.message}  ${chalk.gray(violation.rule)}${fixable}`,
            );
          }
          log('');
        }

        const errorCount = allViolations.filter((v) => v.violation.severity === 'error').length;
        const warnCount = allViolations.filter((v) => v.violation.severity === 'warn').length;
        const fixableCount = allViolations.filter((v) => v.violation.fixable).length;

        const summary: string[] = [];
        if (errorCount > 0) summary.push(chalk.red(`${errorCount} error(s)`));
        if (warnCount > 0) summary.push(chalk.yellow(`${warnCount} warning(s)`));
        if (fixableCount > 0 && !shouldFix) {
          summary.push(chalk.gray(`${fixableCount} fixable with --fix`));
        }

        log(summary.join(', '));

        if (errorCount > 0) {
          process.exit(1);
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
