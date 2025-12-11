import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  DocCov,
  type EnrichedExport,
  type ExampleTypeError,
  type ExampleValidationResult,
  enrichSpec,
  type FixSuggestion,
  findJSDocLocation,
  generateFixesForExport,
  generateReport,
  type JSDocEdit,
  type JSDocPatch,
  mergeFixes,
  NodeFileSystem,
  parseExamplesFlag,
  parseJSDocToPatch,
  type QualityViolation,
  resolveTarget,
  serializeJSDoc,
  validateExamples,
} from '@doccov/sdk';
import {
  DRIFT_CATEGORIES,
  type DriftCategory,
  type DriftType,
  type SpecDocDrift,
  type SpecExport,
} from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadDocCovConfig } from '../config';
import {
  computeStats,
  renderGithubSummary,
  renderHtml,
  renderMarkdown,
  writeReports,
} from '../reports';
import {
  isLLMAssertionParsingAvailable,
  parseAssertionsWithLLM,
} from '../utils/llm-assertion-parser';

type OutputFormat = 'text' | 'json' | 'markdown' | 'html' | 'github';

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
 * Collect all drift issues from enriched exports
 */
function collectDriftsFromExports(
  exports: EnrichedExport[],
): Array<{ export: EnrichedExport; drift: SpecDocDrift }> {
  const results: Array<{ export: EnrichedExport; drift: SpecDocDrift }> = [];
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
  drifts: Array<{ export: EnrichedExport; drift: SpecDocDrift }>,
): Map<EnrichedExport, SpecDocDrift[]> {
  const map = new Map<EnrichedExport, SpecDocDrift[]>();
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
    .description('Check documentation coverage and output reports')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--min-coverage <percentage>', 'Minimum docs coverage percentage (0-100)', (value) =>
      Number(value),
    )
    .option('--max-drift <percentage>', 'Maximum drift percentage allowed (0-100)', (value) =>
      Number(value),
    )
    .option(
      '--examples [mode]',
      'Example validation: presence, typecheck, run (comma-separated). Bare flag runs all.',
    )
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--fix', 'Auto-fix drift issues')
    .option('--write', 'Alias for --fix')
    .option('--dry-run', 'Preview fixes without writing (requires --fix)')
    .option('--format <format>', 'Output format: text, json, markdown, html, github', 'text')
    .option('-o, --output <file>', 'Custom output path (overrides default .doccov/ path)')
    .option('--stdout', 'Output to stdout instead of writing to .doccov/')
    .option('--update-snapshot', 'Force regenerate .doccov/report.json')
    .option('--limit <n>', 'Max exports to show in report tables', '20')
    .option('--max-type-depth <number>', 'Maximum depth for type conversion (default: 20)')
    .option('--no-cache', 'Bypass spec cache and force regeneration')
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
          log(
            chalk.gray(
              `Auto-detected entry point: ${entryPointInfo.path} (from ${entryPointInfo.source})`,
            ),
          );
        }

        // Load config to get minCoverage threshold
        const config = await loadDocCovConfig(targetDir);

        // CLI option takes precedence, then config, then undefined (no threshold)
        const minCoverageRaw = options.minCoverage ?? config?.check?.minCoverage;
        const minCoverage =
          minCoverageRaw !== undefined ? clampCoverage(minCoverageRaw) : undefined;

        const maxDriftRaw = options.maxDrift ?? config?.check?.maxDrift;
        const maxDrift = maxDriftRaw !== undefined ? clampCoverage(maxDriftRaw) : undefined;

        const resolveExternalTypes = !options.skipResolve;

        let specResult: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>> | undefined;

        const doccov = createDocCov({
          resolveExternalTypes,
          maxDepth: options.maxTypeDepth ? parseInt(options.maxTypeDepth, 10) : undefined,
          useCache: options.cache !== false,
          cwd: options.cwd,
        });
        specResult = await doccov.analyzeFileWithDiagnostics(entryFile);

        // Show cache status
        if (specResult.fromCache) {
          log(chalk.gray('Using cached spec'));
        }

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }

        // Enrich the spec with coverage data
        const spec = enrichSpec(specResult.spec);
        const format = (options.format ?? 'text') as OutputFormat;

        // Collect spec diagnostics for later display (after all validation completes)
        const specWarnings = specResult.diagnostics.filter((d) => d.severity === 'warning');
        const specInfos = specResult.diagnostics.filter((d) => d.severity === 'info');

        // Normalize --fix / --write
        const shouldFix = options.fix || options.write;

        // Collect quality violations from enriched spec
        const violations: Array<{ exportName: string; violation: QualityViolation }> = [];
        for (const exp of spec.exports ?? []) {
          for (const v of exp.docs?.violations ?? []) {
            violations.push({ exportName: exp.name, violation: v });
          }
        }

        // Parse --examples flag into validation modes
        const validations = parseExamplesFlag(options.examples);

        // Run example validation using unified SDK function
        let exampleResult: ExampleValidationResult | undefined;
        const typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }> = [];
        const runtimeDrifts: CollectedDrift[] = [];

        if (validations.length > 0) {
          exampleResult = await validateExamples(spec.exports ?? [], {
            validations,
            packagePath: targetDir,
            exportNames: (spec.exports ?? []).map((e) => e.name),
            timeout: 5000,
            installTimeout: 60000,
            llmAssertionParser: isLLMAssertionParsingAvailable()
              ? async (example) => {
                  const result = await parseAssertionsWithLLM(example);
                  return result;
                }
              : undefined,
          });

          // Convert typecheck errors to the expected format
          if (exampleResult.typecheck) {
            for (const err of exampleResult.typecheck.errors) {
              typecheckErrors.push({
                exportName: err.exportName,
                error: err.error,
              });
            }
          }

          // Convert runtime drifts to the expected format
          if (exampleResult.run) {
            for (const drift of exampleResult.run.drifts) {
              runtimeDrifts.push({
                name: drift.exportName,
                type: 'example-runtime-error',
                issue: drift.issue,
                suggestion: drift.suggestion,
                category: 'example',
              });
            }
          }
        }

        const coverageScore = spec.docs?.coverageScore ?? 0;

        // Collect drift issues - exclude example-category drifts unless --examples is used
        const allDriftExports = [...collectDrift(spec.exports ?? []), ...runtimeDrifts];
        let driftExports =
          validations.length > 0
            ? allDriftExports
            : allDriftExports.filter((d) => d.category !== 'example');

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
                  export: EnrichedExport;
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
                // Cast to SpecExport - the SDK function accesses docs.drift internally
                const expWithDrift = { ...exp, docs: { ...exp.docs, drift: drifts } };
                const fixes = generateFixesForExport(
                  expWithDrift as unknown as SpecExport,
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
                  const applyResult = await applyEdits(edits);

                  if (applyResult.errors.length > 0) {
                    for (const err of applyResult.errors) {
                      error(chalk.red(`  ${err.file}: ${err.error}`));
                    }
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

        // Handle --format output for non-text formats
        if (format !== 'text') {
          const limit = parseInt(options.limit, 10) || 20;
          const stats = computeStats(spec);

          // Generate JSON report (always needed for cache)
          const report = generateReport(specResult.spec);
          const jsonContent = JSON.stringify(report, null, 2);

          // Generate requested format content
          let formatContent: string;
          switch (format) {
            case 'json':
              formatContent = jsonContent;
              break;
            case 'markdown':
              formatContent = renderMarkdown(stats, { limit });
              break;
            case 'html':
              formatContent = renderHtml(stats, { limit });
              break;
            case 'github':
              formatContent = renderGithubSummary(stats, {
                coverageScore,
                driftCount: driftExports.length,
                qualityIssues: violations.length,
              });
              break;
            default:
              throw new Error(`Unknown format: ${format}`);
          }

          // Write reports to .doccov/ (or output to stdout with --stdout)
          if (options.stdout) {
            log(formatContent);
          } else {
            writeReports({
              format,
              formatContent,
              jsonContent,
              outputPath: options.output,
              cwd: options.cwd,
            });
          }

          // Calculate drift percentage
          const totalExportsForDrift = spec.exports?.length ?? 0;
          const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
          const driftScore =
            totalExportsForDrift === 0
              ? 0
              : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

          // Still exit with error if thresholds not met
          const coverageFailed = minCoverage !== undefined && coverageScore < minCoverage;
          const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
          const hasQualityErrors =
            violations.filter((v) => v.violation.severity === 'error').length > 0;
          const hasTypecheckErrors = typecheckErrors.length > 0;

          if (coverageFailed || driftFailed || hasQualityErrors || hasTypecheckErrors) {
            process.exit(1);
          }
          return;
        }

        // Calculate drift percentage
        const totalExportsForDrift = spec.exports?.length ?? 0;
        const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
        const driftScore =
          totalExportsForDrift === 0
            ? 0
            : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

        const coverageFailed = minCoverage !== undefined && coverageScore < minCoverage;
        const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
        const hasQualityErrors =
          violations.filter((v) => v.violation.severity === 'error').length > 0;
        const hasTypecheckErrors = typecheckErrors.length > 0;

        // Display spec diagnostics (warnings/info) - now that all validation is complete
        if (specWarnings.length > 0 || specInfos.length > 0) {
          log('');
          for (const diag of specWarnings) {
            log(chalk.yellow(`⚠ ${diag.message}`));
            if (diag.suggestion) {
              log(chalk.gray(`  ${diag.suggestion}`));
            }
          }
          for (const diag of specInfos) {
            log(chalk.cyan(`ℹ ${diag.message}`));
            if (diag.suggestion) {
              log(chalk.gray(`  ${diag.suggestion}`));
            }
          }
        }

        // Render concise summary output (like `info` but with more detail)
        const pkgName = spec.meta?.name ?? 'unknown';
        const pkgVersion = spec.meta?.version ?? '';
        const totalExports = spec.exports?.length ?? 0;
        const errorCount = violations.filter((v) => v.violation.severity === 'error').length;
        const warnCount = violations.filter((v) => v.violation.severity === 'warn').length;

        log('');
        log(chalk.bold(`${pkgName}${pkgVersion ? `@${pkgVersion}` : ''}`));
        log('');
        log(`  Exports:    ${totalExports}`);

        // Coverage with pass/fail indicator when threshold is set
        if (minCoverage !== undefined) {
          if (coverageFailed) {
            log(
              chalk.red(`  Coverage:   ✗ ${coverageScore}%`) + chalk.dim(` (min ${minCoverage}%)`),
            );
          } else {
            log(
              chalk.green(`  Coverage:   ✓ ${coverageScore}%`) +
                chalk.dim(` (min ${minCoverage}%)`),
            );
          }
        } else {
          log(`  Coverage:   ${coverageScore}%`);
        }

        // Drift with pass/fail indicator when threshold is set
        if (maxDrift !== undefined) {
          if (driftFailed) {
            log(chalk.red(`  Drift:      ✗ ${driftScore}%`) + chalk.dim(` (max ${maxDrift}%)`));
          } else {
            log(chalk.green(`  Drift:      ✓ ${driftScore}%`) + chalk.dim(` (max ${maxDrift}%)`));
          }
        } else {
          log(`  Drift:      ${driftScore}%`);
        }

        // Show example validation results (typecheck errors only - runtime errors are in Drift)
        if (exampleResult) {
          const typecheckCount = exampleResult.typecheck?.errors.length ?? 0;
          if (typecheckCount > 0) {
            log(`  Examples:   ${typecheckCount} type errors`);
          } else {
            log(chalk.green(`  Examples:   ✓ validated`));
          }
        }

        if (errorCount > 0 || warnCount > 0) {
          const parts: string[] = [];
          if (errorCount > 0) parts.push(`${errorCount} errors`);
          if (warnCount > 0) parts.push(`${warnCount} warnings`);
          log(`  Quality:    ${parts.join(', ')}`);
        }

        log('');

        // Show pass/fail status
        const failed = coverageFailed || driftFailed || hasQualityErrors || hasTypecheckErrors;

        if (!failed) {
          const thresholdParts: string[] = [];
          if (minCoverage !== undefined) {
            thresholdParts.push(`coverage ${coverageScore}% ≥ ${minCoverage}%`);
          }
          if (maxDrift !== undefined) {
            thresholdParts.push(`drift ${driftScore}% ≤ ${maxDrift}%`);
          }

          if (thresholdParts.length > 0) {
            log(chalk.green(`✓ Check passed (${thresholdParts.join(', ')})`));
          } else {
            log(chalk.green('✓ Check passed'));
            log(
              chalk.dim(
                '  No thresholds configured. Use --min-coverage or --max-drift to enforce.',
              ),
            );
          }
          return;
        }

        // Show failure reasons (only for non-threshold failures since those are shown inline)
        if (hasQualityErrors) {
          log(chalk.red(`✗ ${errorCount} quality errors`));
        }
        if (hasTypecheckErrors) {
          log(chalk.red(`✗ ${typecheckErrors.length} example type errors`));
        }

        log('');
        log(chalk.dim('Use --format json or --format markdown for detailed reports'));

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

type CollectedDrift = {
  name: string;
  type: DriftType;
  issue: string;
  suggestion?: string;
  category: DriftCategory;
};

function collectDrift(
  exportsList: Array<{
    name: string;
    docs?: { drift?: SpecDocDrift[] };
  }>,
): CollectedDrift[] {
  const drifts: CollectedDrift[] = [];
  for (const entry of exportsList) {
    const drift = entry.docs?.drift;
    if (!drift || drift.length === 0) {
      continue;
    }

    for (const d of drift) {
      drifts.push({
        name: entry.name,
        type: d.type,
        issue: d.issue ?? 'Documentation drift detected.',
        suggestion: d.suggestion,
        category: DRIFT_CATEGORIES[d.type],
      });
    }
  }
  return drifts;
}
