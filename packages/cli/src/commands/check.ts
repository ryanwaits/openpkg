import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeSpecContributors,
  analyzeSpecOwnership,
  applyEdits,
  categorizeDrifts,
  type ContributorAnalysisResult,
  createSourceFile,
  DocCov,
  type EnrichedExport,
  type EnrichedOpenPkg,
  type ExampleTypeError,
  type ExampleValidationResult,
  enrichSpec,
  evaluatePolicies,
  type FixSuggestion,
  findJSDocLocation,
  generateFixesForExport,
  generateReport,
  type JSDocEdit,
  type JSDocPatch,
  mergeFixes,
  NodeFileSystem,
  type OwnershipAnalysisResult,
  type PolicyEvaluationResult,
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
import { generateWithFallback, isHostedAPIAvailable } from '../utils/ai-client';
import { isAIGenerationAvailable } from '../utils/ai-generate';
import { mergeFilterOptions, parseVisibilityFlag } from '../utils/filter-options';
import {
  isLLMAssertionParsingAvailable,
  parseAssertionsWithLLM,
} from '../utils/llm-assertion-parser';
import { StepProgress } from '../utils/progress';
import { clampPercentage } from '../utils/validation';

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
    .option('--generate', 'AI-generate missing JSDoc (requires --fix and API key)')
    .option('--dry-run', 'Preview fixes without writing (requires --fix)')
    .option('--format <format>', 'Output format: text, json, markdown, html, github', 'text')
    .option('-o, --output <file>', 'Custom output path (overrides default .doccov/ path)')
    .option('--stdout', 'Output to stdout instead of writing to .doccov/')
    .option('--update-snapshot', 'Force regenerate .doccov/report.json')
    .option('--limit <n>', 'Max exports to show in report tables', '20')
    .option('--max-type-depth <number>', 'Maximum depth for type conversion (default: 20)')
    .option('--no-cache', 'Bypass spec cache and force regeneration')
    .option(
      '--visibility <tags>',
      'Filter by release stage: public,beta,alpha,internal (comma-separated)',
    )
    .option('--owners', 'Show coverage breakdown by CODEOWNERS')
    .option('--contributors', 'Show documentation contributors (git blame)')
    .action(async (entry, options) => {
      try {
        // Parse --examples flag early to determine steps
        const validations = parseExamplesFlag(options.examples);
        const hasExamples = validations.length > 0;

        const stepList = [
          { label: 'Resolved target', activeLabel: 'Resolving target' },
          { label: 'Loaded config', activeLabel: 'Loading config' },
          { label: 'Generated spec', activeLabel: 'Generating spec' },
          { label: 'Enriched spec', activeLabel: 'Enriching spec' },
          ...(hasExamples
            ? [{ label: 'Validated examples', activeLabel: 'Validating examples' }]
            : []),
          { label: 'Processed results', activeLabel: 'Processing results' },
        ];
        const steps = new StepProgress(stepList);
        steps.start();

        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { targetDir, entryFile } = resolved;
        steps.next();

        // Load config to get minCoverage threshold
        const config = await loadDocCovConfig(targetDir);

        // CLI option takes precedence, then config, then undefined (no threshold)
        const minCoverageRaw = options.minCoverage ?? config?.check?.minCoverage;
        const minCoverage =
          minCoverageRaw !== undefined ? clampPercentage(minCoverageRaw) : undefined;

        const maxDriftRaw = options.maxDrift ?? config?.check?.maxDrift;
        const maxDrift = maxDriftRaw !== undefined ? clampPercentage(maxDriftRaw) : undefined;

        // Parse and merge visibility filters
        const cliFilters = {
          include: undefined,
          exclude: undefined,
          visibility: parseVisibilityFlag(options.visibility),
        };
        const resolvedFilters = mergeFilterOptions(config, cliFilters);

        // Log filter info if any filters are applied
        if (resolvedFilters.visibility) {
          log(chalk.dim(`Filtering by visibility: ${resolvedFilters.visibility.join(', ')}`));
        }
        steps.next();

        const resolveExternalTypes = !options.skipResolve;

        let specResult: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>> | undefined;

        const doccov = createDocCov({
          resolveExternalTypes,
          maxDepth: options.maxTypeDepth ? parseInt(options.maxTypeDepth, 10) : undefined,
          useCache: options.cache !== false,
          cwd: options.cwd,
        });

        // Build analysis options with visibility filters
        const analyzeOptions = resolvedFilters.visibility
          ? { filters: { visibility: resolvedFilters.visibility } }
          : {};

        specResult = await doccov.analyzeFileWithDiagnostics(entryFile, analyzeOptions);

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }
        steps.next();

        // Enrich the spec with coverage data
        const spec = enrichSpec(specResult.spec);
        const format = (options.format ?? 'text') as OutputFormat;
        steps.next();

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

        // Evaluate per-path policies if configured
        let policyResult: PolicyEvaluationResult | undefined;
        if (config?.policies && config.policies.length > 0) {
          policyResult = evaluatePolicies(config.policies, spec as EnrichedOpenPkg, {
            baseDir: targetDir,
          });
        }

        // Analyze CODEOWNERS if --owners flag is set
        let ownershipResult: OwnershipAnalysisResult | undefined;
        if (options.owners) {
          ownershipResult = analyzeSpecOwnership(spec as EnrichedOpenPkg, {
            baseDir: targetDir,
          }) ?? undefined;
        }

        // Analyze contributors if --contributors flag is set
        let contributorResult: ContributorAnalysisResult | undefined;
        if (options.contributors) {
          contributorResult = analyzeSpecContributors(spec as EnrichedOpenPkg, {
            baseDir: targetDir,
          }) ?? undefined;
        }

        // Run example validation using unified SDK function
        let exampleResult: ExampleValidationResult | undefined;
        const typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }> = [];
        const runtimeDrifts: CollectedDrift[] = [];

        if (hasExamples) {
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

          steps.next();
        }

        const coverageScore = spec.docs?.coverageScore ?? 0;

        // Collect drift issues - exclude example-category drifts unless --examples is used
        const allDriftExports = [...collectDrift(spec.exports ?? []), ...runtimeDrifts];
        let driftExports = hasExamples
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

        // Handle --generate: AI-generate missing JSDoc for undocumented exports
        const generatedExportKeys = new Set<string>();
        if (shouldFix && options.generate) {
          const hasAIAccess = isHostedAPIAvailable() || isAIGenerationAvailable();
          if (!hasAIAccess) {
            log('');
            log(chalk.yellow('⚠ --generate requires AI access. Options:'));
            log(chalk.dim('  1. Set DOCCOV_API_KEY for hosted AI (included with Team/Pro plan)'));
            log(chalk.dim('  2. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for direct API access'));
          } else {
            // Find undocumented exports (no description)
            const undocumented = (spec.exports ?? []).filter((exp) => {
              // Skip if already has description
              if (exp.description) return false;
              // Skip .d.ts files
              if (exp.source?.file?.endsWith('.d.ts')) return false;
              // Skip if no source location
              if (!exp.source?.file) return false;
              return true;
            });

            if (undocumented.length > 0) {
              log('');
              log(chalk.bold(`Generating JSDoc for ${undocumented.length} undocumented export(s)`));
              log('');

              const aiResult = await generateWithFallback(undocumented, {
                maxConcurrent: 3,
                onProgress: (completed, total, name) => {
                  log(chalk.dim(`  [${completed}/${total}] ${name}`));
                },
                log,
                packageName: spec.meta?.name,
              });

              const generated = aiResult.results;

              const edits: JSDocEdit[] = [];

              for (const result of generated) {
                if (!result.generated) continue;

                const exp = undocumented.find((e) => e.name === result.exportName);
                if (!exp || !exp.source?.file) continue;

                const filePath = path.resolve(targetDir, exp.source.file);
                if (!fs.existsSync(filePath)) continue;

                const sourceFile = createSourceFile(filePath);
                const location = findJSDocLocation(sourceFile, exp.name, exp.source.line);
                if (!location) continue;

                // Parse existing JSDoc if present (shouldn't be for undocumented)
                let existingPatch: JSDocPatch = {};
                if (location.hasExisting && location.existingJSDoc) {
                  existingPatch = parseJSDocToPatch(location.existingJSDoc);
                }

                // Merge AI-generated patch with any existing
                const mergedPatch = { ...existingPatch, ...result.patch };
                const newJSDoc = serializeJSDoc(mergedPatch, location.indent);

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

                generatedExportKeys.add(exp.name);
              }

              if (edits.length > 0) {
                if (options.dryRun) {
                  log('');
                  log(chalk.bold('Dry run - JSDoc that would be generated:'));
                  for (const edit of edits) {
                    const relativePath = path.relative(targetDir, edit.filePath);
                    log(chalk.cyan(`  ${relativePath}:`));
                    log(`    ${chalk.bold(edit.symbolName)} [line ${edit.startLine + 1}]`);
                    log(chalk.green('      + description, params, returns, example'));
                  }
                  log('');
                  log(chalk.gray('Run without --dry-run to apply these changes.'));
                } else {
                  const applyResult = await applyEdits(edits);
                  log('');
                  log(chalk.green(`✓ Generated JSDoc for ${edits.length} export(s)`));

                  // Show quota info if using hosted API
                  if (aiResult.source === 'hosted' && aiResult.quotaRemaining !== undefined) {
                    const remaining =
                      aiResult.quotaRemaining === 'unlimited'
                        ? 'unlimited'
                        : aiResult.quotaRemaining.toLocaleString();
                    log(chalk.dim(`  AI calls remaining: ${remaining}`));
                  }

                  if (applyResult.errors.length > 0) {
                    for (const err of applyResult.errors) {
                      error(chalk.red(`  ${err.file}: ${err.error}`));
                    }
                  }
                }
              }
            }
          }
        }

        steps.complete('Check complete');

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
          const policiesFailed = policyResult && !policyResult.allPassed;

          if (
            coverageFailed ||
            driftFailed ||
            hasQualityErrors ||
            hasTypecheckErrors ||
            policiesFailed
          ) {
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
        const policiesFailed = policyResult && !policyResult.allPassed;

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

        // Show policy results if configured
        if (policyResult && policyResult.results.length > 0) {
          log('');
          log(chalk.bold('  Policies:'));
          for (const result of policyResult.results) {
            const status = result.passed ? chalk.green('✓') : chalk.red('✗');
            const policyPath = result.policy.path;
            const matchCount = result.matchedExports.length;

            if (result.passed) {
              log(`    ${status} ${policyPath} (${matchCount} exports)`);
            } else {
              log(`    ${status} ${policyPath} (${matchCount} exports)`);
              for (const failure of result.failures) {
                log(chalk.red(`        ${failure.message}`));
              }
            }
          }
        }

        // Show CODEOWNERS breakdown if --owners flag is set
        if (ownershipResult) {
          log('');
          log(chalk.bold('  Owners:'));

          // Sort owners by coverage (lowest first to highlight issues)
          const sortedOwners = [...ownershipResult.byOwner.values()].sort(
            (a, b) => a.coverageScore - b.coverageScore,
          );

          for (const stats of sortedOwners) {
            const coverageColor =
              stats.coverageScore >= 80
                ? chalk.green
                : stats.coverageScore >= 50
                  ? chalk.yellow
                  : chalk.red;
            const coverageStr = coverageColor(`${stats.coverageScore}%`);
            const undocCount = stats.undocumentedExports.length;

            log(
              `    ${stats.owner.padEnd(24)} ${coverageStr.padStart(12)} coverage  (${stats.totalExports} exports${undocCount > 0 ? `, ${undocCount} undoc` : ''})`,
            );
          }

          if (ownershipResult.unowned.length > 0) {
            log(
              chalk.dim(
                `    (${ownershipResult.unowned.length} exports have no owner in CODEOWNERS)`,
              ),
            );
          }
        }

        // Show contributor breakdown if --contributors flag is set
        if (contributorResult) {
          log('');
          log(chalk.bold('  Contributors:'));

          // Sort contributors by documented exports (highest first)
          const sortedContributors = [...contributorResult.byContributor.values()].sort(
            (a, b) => b.documentedExports - a.documentedExports,
          );

          // Show top contributors (limit to 10)
          const displayLimit = 10;
          const topContributors = sortedContributors.slice(0, displayLimit);

          for (const stats of topContributors) {
            const name = stats.name.length > 20 ? stats.name.slice(0, 17) + '...' : stats.name;
            const lastDate = stats.lastContribution
              ? stats.lastContribution.toISOString().split('T')[0]
              : 'unknown';

            log(
              `    ${name.padEnd(22)} ${String(stats.documentedExports).padStart(4)} exports  (last: ${lastDate})`,
            );
          }

          if (sortedContributors.length > displayLimit) {
            log(
              chalk.dim(
                `    ... and ${sortedContributors.length - displayLimit} more contributors`,
              ),
            );
          }

          if (contributorResult.unattributed.length > 0) {
            log(
              chalk.dim(
                `    (${contributorResult.unattributed.length} exports could not be attributed via git blame)`,
              ),
            );
          }
        }

        log('');

        // Show pass/fail status
        const failed =
          coverageFailed || driftFailed || hasQualityErrors || hasTypecheckErrors || policiesFailed;

        if (!failed) {
          const thresholdParts: string[] = [];
          if (minCoverage !== undefined) {
            thresholdParts.push(`coverage ${coverageScore}% ≥ ${minCoverage}%`);
          }
          if (maxDrift !== undefined) {
            thresholdParts.push(`drift ${driftScore}% ≤ ${maxDrift}%`);
          }
          if (policyResult) {
            thresholdParts.push(
              `${policyResult.passedCount}/${policyResult.totalPolicies} policies`,
            );
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
        if (policiesFailed && policyResult) {
          log(chalk.red(`✗ ${policyResult.failedCount} policy failures`));
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
