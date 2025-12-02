import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  DocCov,
  detectEntryPoint,
  detectMonorepo,
  type FixSuggestion,
  findJSDocLocation,
  findPackageByName,
  generateFixesForExport,
  type JSDocEdit,
  type JSDocPatch,
  mergeFixes,
  NodeFileSystem,
  parseJSDocToPatch,
  serializeJSDoc,
} from '@doccov/sdk';
import type { SpecDocDrift, SpecExport } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora, { type Ora } from 'ora';

interface FixCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  spinner?: (text: string) => Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<FixCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

/**
 * Collect all drift issues from exports
 */
function collectDrifts(exports: SpecExport[]): Array<{ export: SpecExport; drift: SpecDocDrift }> {
  const results: Array<{ export: SpecExport; drift: SpecDocDrift }> = [];

  for (const exp of exports) {
    const drifts = exp.docs?.drift ?? [];
    for (const drift of drifts) {
      results.push({ export: exp, drift });
    }
  }

  return results;
}

/**
 * Filter drifts by type
 */
function filterDriftsByType(
  drifts: Array<{ export: SpecExport; drift: SpecDocDrift }>,
  onlyTypes?: string,
): Array<{ export: SpecExport; drift: SpecDocDrift }> {
  if (!onlyTypes) return drifts;

  const allowedTypes = new Set(onlyTypes.split(',').map((t) => t.trim()));
  return drifts.filter((d) => allowedTypes.has(d.drift.type));
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

export function registerFixCommand(
  program: Command,
  dependencies: FixCommandDependencies = {},
): void {
  const { createDocCov, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('fix [entry]')
    .description('Automatically fix documentation drift')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--only <types>', 'Only fix specific drift types (comma-separated)')
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry as string | undefined;

        // Create filesystem abstraction for detection
        const fileSystem = new NodeFileSystem(options.cwd);

        // Handle monorepo package targeting
        if (options.package) {
          const mono = await detectMonorepo(fileSystem);
          if (!mono.isMonorepo) {
            throw new Error(`Not a monorepo. Remove --package flag for single-package repos.`);
          }
          const pkg = findPackageByName(mono.packages, options.package);
          if (!pkg) {
            const available = mono.packages.map((p) => p.name).join(', ');
            throw new Error(`Package "${options.package}" not found. Available: ${available}`);
          }
          targetDir = path.join(options.cwd, pkg.path);
          log(chalk.gray(`Found package at ${pkg.path}`));
        }

        // Resolve entry file
        if (!entryFile) {
          const targetFs = new NodeFileSystem(targetDir);
          const detected = await detectEntryPoint(targetFs);
          entryFile = path.join(targetDir, detected.path);
          log(chalk.gray(`Auto-detected entry point: ${detected.path} (from ${detected.source})`));
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

        // Analyze the codebase
        const analyzeSpinner = spinner('Analyzing documentation...');
        analyzeSpinner.start();

        const doccov = createDocCov({ resolveExternalTypes });
        const result = await doccov.analyzeFileWithDiagnostics(entryFile);
        const spec = result.spec;

        analyzeSpinner.succeed('Analysis complete');

        // Collect all drifts
        const allDrifts = collectDrifts(spec.exports ?? []);

        if (allDrifts.length === 0) {
          log(chalk.green('No drift issues found. Documentation is in sync!'));
          return;
        }

        // Filter by --only if specified
        const filteredDrifts = filterDriftsByType(allDrifts, options.only);

        if (filteredDrifts.length === 0) {
          log(chalk.yellow('No matching drift issues for the specified types.'));
          return;
        }

        // Categorize fixable vs non-fixable
        const { fixable, nonFixable } = categorizeDrifts(filteredDrifts.map((d) => d.drift));

        if (fixable.length === 0) {
          log(
            chalk.yellow(`Found ${nonFixable.length} drift issue(s), but none are auto-fixable.`),
          );
          log(chalk.gray('Non-fixable drift types require manual intervention:'));
          for (const drift of nonFixable.slice(0, 5)) {
            log(chalk.gray(`  • ${drift.type}: ${drift.issue}`));
          }
          return;
        }

        log('');
        log(chalk.bold(`Found ${fixable.length} fixable issue(s)`));
        if (nonFixable.length > 0) {
          log(chalk.gray(`(${nonFixable.length} non-fixable issue(s) skipped)`));
        }
        log('');

        // Group by export and generate fixes
        const groupedDrifts = groupByExport(
          filteredDrifts.filter((d) => fixable.includes(d.drift)),
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

        if (edits.length === 0) {
          log(chalk.yellow('No edits could be generated.'));
          return;
        }

        // Display or apply edits
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

              // Show what fixes are being applied
              for (const fix of fixes) {
                log(chalk.green(`      + ${fix.description}`));
              }
            }
            log('');
          }

          log(chalk.gray('Run without --dry-run to apply these changes.'));
        } else {
          const applySpinner = spinner('Applying fixes...');
          applySpinner.start();

          const result = await applyEdits(edits);

          if (result.errors.length > 0) {
            applySpinner.warn('Some fixes could not be applied');
            for (const err of result.errors) {
              error(chalk.red(`  ${err.file}: ${err.error}`));
            }
          } else {
            applySpinner.succeed(
              `Applied ${result.editsApplied} fix(es) to ${result.filesModified} file(s)`,
            );
          }

          // Show summary
          log('');
          for (const [filePath, fileEdits] of editsByFile) {
            const relativePath = path.relative(targetDir, filePath);
            log(chalk.green(`  ✓ ${relativePath}: ${fileEdits.length} fix(es)`));
          }
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
