import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  DocCov,
  type EnrichedExport,
  type ExampleTypeError,
  type ExampleValidation,
  type ExampleValidationResult,
  enrichSpec,
  findExportReferences,
  type FixSuggestion,
  findJSDocLocation,
  generateFixesForExport,
  generateReport,
  type JSDocEdit,
  type JSDocPatch,
  type MarkdownDocFile,
  mergeFixes,
  NodeFileSystem,
  parseExamplesFlag,
  parseJSDocToPatch,
  parseMarkdownFiles,
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
import { glob } from 'glob';
import { loadDocCovConfig } from '../config';
import {
  computeStats,
  renderGithubSummary,
  renderHtml,
  renderMarkdown,
  writeReports,
} from '../reports';
import { mergeFilterOptions, parseVisibilityFlag } from '../utils/filter-options';
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
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for stale refs', collect, [])
    .option('--fix', 'Auto-fix drift issues')
    .option('--write', 'Alias for --fix')
    .option('--preview', 'Preview fixes with diff output (implies --fix)')
    .option('--dry-run', 'Alias for --preview')
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
    .action(async (entry, options) => {
      try {
        // Parse --examples flag (may be overridden by config later)
        let validations = parseExamplesFlag(options.examples);
        let hasExamples = validations.length > 0;

        // Initial step list (may be updated after config load)
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

        // Merge examples config if CLI flag not set
        if (!hasExamples && config?.check?.examples) {
          const configExamples = config.check.examples;
          if (Array.isArray(configExamples)) {
            validations = configExamples as ExampleValidation[];
          } else if (typeof configExamples === 'string') {
            validations = parseExamplesFlag(configExamples);
          }
          hasExamples = validations.length > 0;
        }

        // CLI option takes precedence, then config, then sensible defaults
        // Default: 80% minCoverage when no config exists
        const DEFAULT_MIN_COVERAGE = 80;
        const minCoverageRaw = options.minCoverage ?? config?.check?.minCoverage ?? DEFAULT_MIN_COVERAGE;
        const minCoverage = clampPercentage(minCoverageRaw);

        // maxDrift has no default - drift is shown but doesn't fail unless configured
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

        // Normalize --fix / --write / --preview / --dry-run
        const isPreview = options.preview || options.dryRun;
        const shouldFix = options.fix || options.write || isPreview;

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

        // Markdown docs analysis: detect stale references
        const staleRefs: StaleReference[] = [];
        let docsPatterns = options.docs as string[];

        // If no --docs flag, try to load from config
        if (docsPatterns.length === 0 && config?.docs?.include) {
          docsPatterns = config.docs.include;
        }

        if (docsPatterns.length > 0) {
          const markdownFiles = await loadMarkdownFiles(docsPatterns, targetDir);

          if (markdownFiles.length > 0) {
            // Get all export names from spec
            const exportNames = (spec.exports ?? []).map((e) => e.name);
            const exportSet = new Set(exportNames);

            // Check each code block for imports that reference non-existent exports
            for (const mdFile of markdownFiles) {
              for (const block of mdFile.codeBlocks) {
                const codeLines = block.code.split('\n');
                for (let i = 0; i < codeLines.length; i++) {
                  const line = codeLines[i];
                  // Check for imports from the package
                  const importMatch = line.match(
                    /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*['"]/,
                  );
                  if (importMatch) {
                    const imports = importMatch[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
                    for (const imp of imports) {
                      if (imp && !exportSet.has(imp)) {
                        staleRefs.push({
                          file: mdFile.path,
                          line: block.lineStart + i,
                          exportName: imp,
                          context: line.trim(),
                        });
                      }
                    }
                  }
                }
              }
            }
          }
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
                if (isPreview) {
                  log(chalk.bold('Preview - changes that would be made:'));
                  log('');

                  for (const [filePath, fileEdits] of editsByFile) {
                    const relativePath = path.relative(targetDir, filePath);

                    for (const { export: exp, edit, fixes } of fileEdits) {
                      log(chalk.cyan(`${relativePath}:${edit.startLine + 1}`));
                      log(chalk.bold(`  ${exp.name}`));
                      log('');

                      // Show unified diff
                      if (edit.hasExisting && edit.existingJSDoc) {
                        // Show before/after diff
                        const oldLines = edit.existingJSDoc.split('\n');
                        const newLines = edit.newJSDoc.split('\n');

                        // Simple diff: show removed then added
                        for (const line of oldLines) {
                          log(chalk.red(`  - ${line}`));
                        }
                        for (const line of newLines) {
                          log(chalk.green(`  + ${line}`));
                        }
                      } else {
                        // New JSDoc - just show additions
                        const newLines = edit.newJSDoc.split('\n');
                        for (const line of newLines) {
                          log(chalk.green(`  + ${line}`));
                        }
                      }

                      log('');
                      log(chalk.dim(`  Fixes: ${fixes.map((f) => f.description).join(', ')}`));
                      log('');
                    }
                  }

                  const totalFixes = Array.from(editsByFile.values()).reduce(
                    (sum, edits) => sum + edits.reduce((s, e) => s + e.fixes.length, 0),
                    0,
                  );
                  log(
                    chalk.yellow(
                      `${totalFixes} fix(es) across ${editsByFile.size} file(s) would be applied.`,
                    ),
                  );
                  log(chalk.gray('Run with --fix to apply these changes.'));
                } else {
                  const applyResult = await applyEdits(edits);

                  if (applyResult.errors.length > 0) {
                    for (const err of applyResult.errors) {
                      error(chalk.red(`  ${err.file}: ${err.error}`));
                    }
                  }

                  // Show summary of applied fixes
                  const totalFixes = Array.from(editsByFile.values()).reduce(
                    (sum, edits) => sum + edits.reduce((s, e) => s + e.fixes.length, 0),
                    0,
                  );
                  log('');
                  log(
                    chalk.green(
                      `✓ Applied ${totalFixes} fix(es) to ${applyResult.filesModified} file(s)`,
                    ),
                  );

                  // List files modified
                  for (const [filePath, fileEdits] of editsByFile) {
                    const relativePath = path.relative(targetDir, filePath);
                    const fixCount = fileEdits.reduce((s, e) => s + e.fixes.length, 0);
                    log(chalk.dim(`  ${relativePath} (${fixCount} fixes)`));
                  }
                }
              }
            }
          }

          // Filter out fixed drifts from the evaluation (only when actually applying)
          if (!isPreview) {
            driftExports = driftExports.filter((d) => !fixedDriftKeys.has(`${d.name}:${d.issue}`));
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
          const coverageFailed = coverageScore < minCoverage;
          const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
          const hasTypecheckErrors = typecheckErrors.length > 0;

          if (coverageFailed || driftFailed || hasTypecheckErrors) {
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

        const coverageFailed = coverageScore < minCoverage;
        const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
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

        // Render concise summary output
        const pkgName = spec.meta?.name ?? 'unknown';
        const pkgVersion = spec.meta?.version ?? '';
        const totalExports = spec.exports?.length ?? 0;

        log('');
        log(chalk.bold(`${pkgName}${pkgVersion ? `@${pkgVersion}` : ''}`));
        log('');
        log(`  Exports:    ${totalExports}`);

        // Coverage with pass/fail indicator
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
            log(chalk.yellow(`  Examples:   ${typecheckCount} type error(s)`));
            // Show first few errors with details
            for (const err of typecheckErrors.slice(0, 5)) {
              const loc = `example[${err.error.exampleIndex}]:${err.error.line}:${err.error.column}`;
              log(chalk.dim(`              ${err.exportName} ${loc}`));
              log(chalk.red(`                ${err.error.message}`));
            }
            if (typecheckErrors.length > 5) {
              log(chalk.dim(`              ... and ${typecheckErrors.length - 5} more`));
            }
          } else {
            log(chalk.green(`  Examples:   ✓ validated`));
          }
        }

        // Show stale docs references
        const hasStaleRefs = staleRefs.length > 0;
        if (hasStaleRefs) {
          log(chalk.yellow(`  Docs:       ${staleRefs.length} stale ref(s)`));
          for (const ref of staleRefs.slice(0, 5)) {
            log(chalk.dim(`              ${ref.file}:${ref.line} - "${ref.exportName}"`));
          }
          if (staleRefs.length > 5) {
            log(chalk.dim(`              ... and ${staleRefs.length - 5} more`));
          }
        }

        log('');

        // Show pass/fail status
        const failed = coverageFailed || driftFailed || hasTypecheckErrors || hasStaleRefs;

        if (!failed) {
          const thresholdParts: string[] = [];
          thresholdParts.push(`coverage ${coverageScore}% ≥ ${minCoverage}%`);
          if (maxDrift !== undefined) {
            thresholdParts.push(`drift ${driftScore}% ≤ ${maxDrift}%`);
          }

          log(chalk.green(`✓ Check passed (${thresholdParts.join(', ')})`));
          return;
        }

        // Show failure reasons
        if (hasTypecheckErrors) {
          log(chalk.red(`✗ ${typecheckErrors.length} example type errors`));
        }
        if (hasStaleRefs) {
          log(chalk.red(`✗ ${staleRefs.length} stale references in docs`));
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

/**
 * Collect multiple values for an option
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Load markdown files from glob patterns
 */
async function loadMarkdownFiles(patterns: string[], cwd: string): Promise<MarkdownDocFile[]> {
  const files: Array<{ path: string; content: string }> = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true, cwd });
    for (const filePath of matches) {
      try {
        const fullPath = path.resolve(cwd, filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return parseMarkdownFiles(files);
}

/**
 * Stale reference found in markdown docs
 */
type StaleReference = {
  file: string;
  line: number;
  exportName: string;
  context: string;
};
