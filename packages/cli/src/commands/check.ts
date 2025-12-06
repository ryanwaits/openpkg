import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  DocCov,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  type ExampleRunResult,
  type ExampleTypeError,
  type FixSuggestion,
  findJSDocLocation,
  generateFixesForExport,
  getDefaultConfig as getLintDefaultConfig,
  hasNonAssertionComments,
  type JSDocEdit,
  type JSDocPatch,
  type LintViolation,
  lintExport,
  mergeFixes,
  NodeFileSystem,
  parseAssertions,
  parseJSDocToPatch,
  resolveTarget,
  runExamplesWithPackage,
  serializeJSDoc,
  typecheckExamples,
} from '@doccov/sdk';
import type { SpecDocDrift, SpecExport } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  isLLMAssertionParsingAvailable,
  parseAssertionsWithLLM,
} from '../utils/llm-assertion-parser';

interface CheckCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<CheckCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  log: console.log,
  error: console.error,
};

/**
 * Collect all drift issues from exports
 */
function collectDriftsFromExports(
  exports: SpecExport[],
): Array<{ export: SpecExport; drift: SpecDocDrift }> {
  const results: Array<{ export: SpecExport; drift: SpecDocDrift }> = [];
  for (const exp of exports) {
    for (const drift of exp.docs?.drift ?? []) {
      results.push({ export: exp, drift });
    }
  }
  return results;
}

/**
 * Group drifts by export
 */
function groupByExport(
  drifts: Array<{ export: SpecExport; drift: SpecDocDrift }>,
): Map<SpecExport, SpecDocDrift[]> {
  const map = new Map<SpecExport, SpecDocDrift[]>();
  for (const { export: exp, drift } of drifts) {
    const existing = map.get(exp) ?? [];
    existing.push(drift);
    map.set(exp, existing);
  }
  return map;
}

export function registerCheckCommand(
  program: Command,
  dependencies: CheckCommandDependencies = {},
): void {
  const { createDocCov, log, error } = {
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
    .option('--exec', 'Execute @example blocks at runtime')
    .option('--no-lint', 'Skip lint checks')
    .option('--no-typecheck', 'Skip example type checking')
    .option('--ignore-drift', 'Do not fail on documentation drift')
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--fix', 'Auto-fix drift and lint issues')
    .option('--write', 'Alias for --fix')
    .option('--dry-run', 'Preview fixes without writing (requires --fix)')
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

        const minCoverage = clampCoverage(options.minCoverage ?? 80);
        const resolveExternalTypes = !options.skipResolve;

        // Use simple text indicator for CPU-intensive analysis (ora can't animate during blocking operations)
        process.stdout.write(chalk.cyan('> Analyzing documentation coverage...\n'));

        let specResult: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>> | undefined;

        try {
          const doccov = createDocCov({ resolveExternalTypes });
          specResult = await doccov.analyzeFileWithDiagnostics(entryFile);
          process.stdout.write(chalk.green('✓ Documentation analysis complete\n'));
        } catch (analysisError) {
          process.stdout.write(chalk.red('✗ Failed to analyze documentation coverage\n'));
          throw analysisError;
        }

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }

        const spec = specResult.spec;

        // Display spec diagnostics (warnings/info)
        const warnings = specResult.diagnostics.filter((d) => d.severity === 'warning');
        const infos = specResult.diagnostics.filter((d) => d.severity === 'info');

        if (warnings.length > 0 || infos.length > 0) {
          log('');
          for (const diag of warnings) {
            log(chalk.yellow(`⚠ ${diag.message}`));
            if (diag.suggestion) {
              log(chalk.gray(`  ${diag.suggestion}`));
            }
          }
          for (const diag of infos) {
            log(chalk.cyan(`ℹ ${diag.message}`));
            if (diag.suggestion) {
              log(chalk.gray(`  ${diag.suggestion}`));
            }
          }
          log('');
        }

        // Normalize --fix / --write
        const shouldFix = options.fix || options.write;

        // Run lint if not disabled
        const lintViolations: Array<{ exportName: string; violation: LintViolation }> = [];
        if (options.lint !== false) {
          process.stdout.write(chalk.cyan('> Running lint checks...\n'));

          const lintConfig = getLintDefaultConfig();
          for (const exp of spec.exports ?? []) {
            const violations = lintExport(exp, undefined, lintConfig);
            for (const violation of violations) {
              lintViolations.push({ exportName: exp.name, violation });
            }
          }

          if (lintViolations.length === 0) {
            process.stdout.write(chalk.green('✓ No lint issues\n'));
          } else {
            const errors = lintViolations.filter((v) => v.violation.severity === 'error').length;
            const warns = lintViolations.filter((v) => v.violation.severity === 'warn').length;
            process.stdout.write(
              chalk.yellow(
                `⚠ ${lintViolations.length} lint issue(s) (${errors} error, ${warns} warn)\n`,
              ),
            );
          }
        }

        // Run typecheck if not disabled
        const typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }> = [];
        if (options.typecheck !== false) {
          const allExamplesForTypecheck: Array<{ exportName: string; examples: string[] }> = [];
          for (const exp of spec.exports ?? []) {
            if (exp.examples && exp.examples.length > 0) {
              allExamplesForTypecheck.push({
                exportName: exp.name,
                examples: exp.examples as string[],
              });
            }
          }

          if (allExamplesForTypecheck.length > 0) {
            process.stdout.write(chalk.cyan('> Type-checking examples...\n'));

            for (const { exportName, examples } of allExamplesForTypecheck) {
              const result = typecheckExamples(examples, targetDir);
              for (const err of result.errors) {
                typecheckErrors.push({ exportName, error: err });
              }
            }

            if (typecheckErrors.length === 0) {
              process.stdout.write(chalk.green('✓ All examples type-check\n'));
            } else {
              process.stdout.write(chalk.red(`✗ ${typecheckErrors.length} type error(s)\n`));
            }
          }
        }

        // Run examples at runtime if --exec flag is set
        const runtimeDrifts: Array<{ name: string; issue: string; suggestion?: string }> = [];
        if (options.exec) {
          // Collect all examples from all exports
          const allExamples: Array<{ exportName: string; examples: string[] }> = [];
          for (const entry of spec.exports ?? []) {
            if (entry.examples && entry.examples.length > 0) {
              allExamples.push({ exportName: entry.name, examples: entry.examples });
            }
          }

          if (allExamples.length === 0) {
            log(chalk.gray('No @example blocks found'));
          } else {
            process.stdout.write(chalk.cyan('> Installing package for examples...\n'));

            // Flatten examples for batch execution
            const flatExamples = allExamples.flatMap((e) => e.examples);

            // Run all examples with package installed
            const packageResult = await runExamplesWithPackage(flatExamples, {
              packagePath: targetDir,
              timeout: 5000,
              installTimeout: 60000,
              cwd: targetDir,
            });

            if (!packageResult.installSuccess) {
              process.stdout.write(
                chalk.red(`✗ Package install failed: ${packageResult.installError}\n`),
              );
              log(chalk.yellow('Skipping example execution. Ensure the package is built.'));
            } else {
              process.stdout.write(chalk.cyan('> Running @example blocks...\n'));

              let examplesRun = 0;
              let examplesFailed = 0;
              let exampleIndex = 0;

              // Map results back to exports
              for (const { exportName, examples } of allExamples) {
                const entryResults = new Map<number, ExampleRunResult>();

                for (let i = 0; i < examples.length; i++) {
                  const result = packageResult.results.get(exampleIndex);
                  if (result) {
                    entryResults.set(i, result);
                    examplesRun++;
                    if (!result.success) examplesFailed++;
                  }
                  exampleIndex++;
                }

                // Find the entry to detect drifts
                const entry = (spec.exports ?? []).find((e) => e.name === exportName);
                if (entry) {
                  // Detect runtime errors
                  const runtimeErrorDrifts = detectExampleRuntimeErrors(entry, entryResults);
                  for (const drift of runtimeErrorDrifts) {
                    runtimeDrifts.push({
                      name: entry.name,
                      issue: drift.issue,
                      suggestion: drift.suggestion,
                    });
                  }

                  // Detect assertion failures (only for successful examples)
                  const assertionDrifts = detectExampleAssertionFailures(entry, entryResults);
                  for (const drift of assertionDrifts) {
                    runtimeDrifts.push({
                      name: entry.name,
                      issue: drift.issue,
                      suggestion: drift.suggestion,
                    });
                  }

                  // LLM fallback: if no standard assertions but comments exist
                  if (isLLMAssertionParsingAvailable() && entry.examples) {
                    for (let exIdx = 0; exIdx < entry.examples.length; exIdx++) {
                      const example = entry.examples[exIdx];
                      const result = entryResults.get(exIdx);
                      if (!result?.success || typeof example !== 'string') continue;

                      // Check if regex found no assertions but comments exist
                      const regexAssertions = parseAssertions(example);
                      if (regexAssertions.length === 0 && hasNonAssertionComments(example)) {
                        // Try LLM fallback
                        const llmResult = await parseAssertionsWithLLM(example);
                        if (llmResult?.hasAssertions && llmResult.assertions.length > 0) {
                          // Validate LLM-extracted assertions against stdout
                          const stdoutLines = result.stdout
                            .split('\n')
                            .map((l) => l.trim())
                            .filter((l) => l.length > 0);

                          for (let aIdx = 0; aIdx < llmResult.assertions.length; aIdx++) {
                            const assertion = llmResult.assertions[aIdx];
                            const actual = stdoutLines[aIdx];

                            if (actual === undefined) {
                              runtimeDrifts.push({
                                name: entry.name,
                                issue: `Assertion expected "${assertion.expected}" but no output was produced`,
                                suggestion: `Consider using standard syntax: ${assertion.suggestedSyntax}`,
                              });
                            } else if (assertion.expected.trim() !== actual.trim()) {
                              runtimeDrifts.push({
                                name: entry.name,
                                issue: `Assertion failed: expected "${assertion.expected}" but got "${actual}"`,
                                suggestion: `Consider using standard syntax: ${assertion.suggestedSyntax}`,
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              if (examplesFailed > 0) {
                process.stdout.write(
                  chalk.red(`✗ ${examplesFailed}/${examplesRun} example(s) failed\n`),
                );
              } else {
                process.stdout.write(chalk.green(`✓ ${examplesRun} example(s) passed\n`));
              }
            }
          }
        }

        const coverageScore = spec.docs?.coverageScore ?? 0;
        const failingExports = collectFailingExports(spec.exports ?? [], minCoverage);
        const missingExamples = options.requireExamples
          ? failingExports.filter((item) => item.missing?.includes('examples'))
          : [];
        let driftExports = [...collectDrift(spec.exports ?? []), ...runtimeDrifts];

        // Handle --fix / --write: auto-fix drift issues
        const fixedDriftKeys = new Set<string>();
        if (shouldFix && driftExports.length > 0) {
          const allDrifts = collectDriftsFromExports(spec.exports ?? []);

          if (allDrifts.length > 0) {
            const { fixable, nonFixable } = categorizeDrifts(allDrifts.map((d) => d.drift));

            if (fixable.length === 0) {
              log(
                chalk.yellow(
                  `Found ${nonFixable.length} drift issue(s), but none are auto-fixable.`,
                ),
              );
            } else {
              log('');
              log(chalk.bold(`Found ${fixable.length} fixable issue(s)`));
              if (nonFixable.length > 0) {
                log(chalk.gray(`(${nonFixable.length} non-fixable issue(s) skipped)`));
              }
              log('');

              // Group by export and generate fixes
              const groupedDrifts = groupByExport(
                allDrifts.filter((d) => fixable.includes(d.drift)),
              );

              const edits: JSDocEdit[] = [];
              const editsByFile = new Map<
                string,
                Array<{
                  export: SpecExport;
                  edit: JSDocEdit;
                  fixes: FixSuggestion[];
                  existingPatch: JSDocPatch;
                }>
              >();

              for (const [exp, drifts] of groupedDrifts) {
                // Skip if no source location
                if (!exp.source?.file) {
                  log(chalk.gray(`  Skipping ${exp.name}: no source location`));
                  continue;
                }

                // Skip .d.ts files
                if (exp.source.file.endsWith('.d.ts')) {
                  log(chalk.gray(`  Skipping ${exp.name}: declaration file`));
                  continue;
                }

                const filePath = path.resolve(targetDir, exp.source.file);

                // Check file exists
                if (!fs.existsSync(filePath)) {
                  log(chalk.gray(`  Skipping ${exp.name}: file not found`));
                  continue;
                }

                // Find JSDoc location in source file
                const sourceFile = createSourceFile(filePath);
                const location = findJSDocLocation(sourceFile, exp.name, exp.source.line);

                if (!location) {
                  log(chalk.gray(`  Skipping ${exp.name}: could not find declaration`));
                  continue;
                }

                // Parse existing JSDoc if present
                let existingPatch: JSDocPatch = {};
                if (location.hasExisting && location.existingJSDoc) {
                  existingPatch = parseJSDocToPatch(location.existingJSDoc);
                }

                // Generate fixes
                const fixes = generateFixesForExport(
                  { ...exp, docs: { ...exp.docs, drift: drifts } },
                  existingPatch,
                );

                if (fixes.length === 0) continue;

                // Track which drifts we're fixing
                for (const drift of drifts) {
                  fixedDriftKeys.add(`${exp.name}:${drift.issue}`);
                }

                // Merge all fixes into a single patch
                const mergedPatch = mergeFixes(fixes, existingPatch);

                // Serialize the new JSDoc
                const newJSDoc = serializeJSDoc(mergedPatch, location.indent);

                const edit: JSDocEdit = {
                  filePath,
                  symbolName: exp.name,
                  startLine: location.startLine,
                  endLine: location.endLine,
                  hasExisting: location.hasExisting,
                  existingJSDoc: location.existingJSDoc,
                  newJSDoc,
                  indent: location.indent,
                };

                edits.push(edit);

                // Group for display
                const fileEdits = editsByFile.get(filePath) ?? [];
                fileEdits.push({ export: exp, edit, fixes, existingPatch });
                editsByFile.set(filePath, fileEdits);
              }

              if (edits.length > 0) {
                if (options.dryRun) {
                  log(chalk.bold('Dry run - changes that would be made:'));
                  log('');

                  for (const [filePath, fileEdits] of editsByFile) {
                    const relativePath = path.relative(targetDir, filePath);
                    log(chalk.cyan(`  ${relativePath}:`));

                    for (const { export: exp, edit, fixes } of fileEdits) {
                      const lineInfo = edit.hasExisting
                        ? `lines ${edit.startLine + 1}-${edit.endLine + 1}`
                        : `line ${edit.startLine + 1}`;

                      log(`    ${chalk.bold(exp.name)} [${lineInfo}]`);

                      for (const fix of fixes) {
                        log(chalk.green(`      + ${fix.description}`));
                      }
                    }
                    log('');
                  }

                  log(chalk.gray('Run without --dry-run to apply these changes.'));
                } else {
                  process.stdout.write(chalk.cyan('> Applying fixes...\n'));

                  const applyResult = await applyEdits(edits);

                  if (applyResult.errors.length > 0) {
                    process.stdout.write(chalk.yellow('⚠ Some fixes could not be applied\n'));
                    for (const err of applyResult.errors) {
                      error(chalk.red(`  ${err.file}: ${err.error}`));
                    }
                  } else {
                    process.stdout.write(
                      chalk.green(
                        `✓ Applied ${applyResult.editsApplied} fix(es) to ${applyResult.filesModified} file(s)\n`,
                      ),
                    );
                  }

                  // Show summary
                  log('');
                  for (const [filePath, fileEdits] of editsByFile) {
                    const relativePath = path.relative(targetDir, filePath);
                    log(chalk.green(`  ✓ ${relativePath}: ${fileEdits.length} fix(es)`));
                  }
                }
              }
            }
          }

          // Filter out fixed drifts from the evaluation
          if (!options.dryRun) {
            driftExports = driftExports.filter((d) => !fixedDriftKeys.has(`${d.name}:${d.issue}`));
          }
        }

        const coverageFailed = coverageScore < minCoverage;
        const hasMissingExamples = missingExamples.length > 0;
        const hasDrift = !options.ignoreDrift && driftExports.length > 0;
        const hasLintErrors =
          lintViolations.filter((v) => v.violation.severity === 'error').length > 0;
        const hasTypecheckErrors = typecheckErrors.length > 0;

        if (
          !coverageFailed &&
          !hasMissingExamples &&
          !hasDrift &&
          !hasLintErrors &&
          !hasTypecheckErrors
        ) {
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

        if (hasLintErrors) {
          error('');
          error(chalk.bold('Lint errors:'));
          for (const { exportName, violation } of lintViolations
            .filter((v) => v.violation.severity === 'error')
            .slice(0, 10)) {
            error(chalk.red(`  • ${exportName}: ${violation.message}`));
          }
        }

        if (hasTypecheckErrors) {
          error('');
          error(chalk.bold('Type errors in examples:'));
          for (const { exportName, error: err } of typecheckErrors.slice(0, 10)) {
            error(
              chalk.red(
                `  • ${exportName} @example ${err.exampleIndex + 1}, line ${err.line}: ${err.message}`,
              ),
            );
          }
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

        process.exit(1);
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exit(1);
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
