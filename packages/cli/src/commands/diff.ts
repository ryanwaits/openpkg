import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  diffSpecWithDocs,
  getDocsImpactSummary,
  hasDocsImpact,
  type MarkdownDocFile,
  type MemberChange,
  parseMarkdownFiles,
  type SpecDiffWithDocs,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { glob } from 'glob';
import { loadDocCovConfig } from '../config';
import { generateImpactSummary, isAIDocsAnalysisAvailable } from '../utils/docs-impact-ai';

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

type OutputFormat = 'text' | 'json' | 'github' | 'report';

/** Strict mode options for --strict flag */
type StrictOption = 'regression' | 'drift' | 'docs-impact' | 'breaking' | 'undocumented' | 'all';

const VALID_STRICT_OPTIONS: StrictOption[] = [
  'regression',
  'drift',
  'docs-impact',
  'breaking',
  'undocumented',
  'all',
];

/**
 * Parse --strict flag value into set of options
 */
function parseStrictOptions(value: string | undefined): Set<StrictOption> {
  if (!value) return new Set();

  const options = value.split(',').map((s) => s.trim().toLowerCase()) as StrictOption[];
  const result = new Set<StrictOption>();

  for (const opt of options) {
    if (opt === 'all') {
      // 'all' expands to all options
      for (const o of VALID_STRICT_OPTIONS) {
        if (o !== 'all') result.add(o);
      }
    } else if (VALID_STRICT_OPTIONS.includes(opt)) {
      result.add(opt);
    }
  }

  return result;
}

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
    .option('--format <format>', 'Output format: text, json, github, report', 'text')
    .option(
      '--strict <options>',
      'Fail on conditions (comma-separated): regression, drift, docs-impact, breaking, undocumented, all',
    )
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for impact', collect, [])
    .option('--ai', 'Use AI for deeper analysis and fix suggestions')
    // Keep legacy flags for backwards compatibility (hidden)
    .option('--output <format>', 'DEPRECATED: Use --format instead')
    .option('--fail-on-regression', 'DEPRECATED: Use --strict regression')
    .option('--fail-on-drift', 'DEPRECATED: Use --strict drift')
    .option('--fail-on-docs-impact', 'DEPRECATED: Use --strict docs-impact')
    .action(async (base: string, head: string, options) => {
      try {
        const baseSpec = loadSpec(base, readFileSync);
        const headSpec = loadSpec(head, readFileSync);

        // Load markdown files if --docs specified or from config
        let markdownFiles: MarkdownDocFile[] | undefined;
        let docsPatterns = options.docs as string[];

        // If no --docs flag, try to load from config
        if (!docsPatterns || docsPatterns.length === 0) {
          const configResult = await loadDocCovConfig(process.cwd());
          if (configResult?.docs?.include) {
            docsPatterns = configResult.docs.include;
            log(chalk.gray(`Using docs patterns from config: ${docsPatterns.join(', ')}`));
          }
        }

        if (docsPatterns && docsPatterns.length > 0) {
          markdownFiles = await loadMarkdownFiles(docsPatterns);
        }

        const diff = diffSpecWithDocs(baseSpec, headSpec, { markdownFiles });

        // Handle format (with legacy --output fallback)
        const format = (options.format ?? options.output ?? 'text') as OutputFormat;

        // Parse strict options (with legacy flag fallback)
        const strictOptions = parseStrictOptions(options.strict);

        // Legacy flag support
        if (options.failOnRegression) strictOptions.add('regression');
        if (options.failOnDrift) strictOptions.add('drift');
        if (options.failOnDocsImpact) strictOptions.add('docs-impact');

        // Output based on format
        switch (format) {
          case 'json':
            log(JSON.stringify(diff, null, 2));
            break;

          case 'github':
            printGitHubAnnotations(diff, log);
            break;

          case 'report':
            // For now, output a simple HTML report to stdout
            // In future, this could write to a file
            log(generateHTMLReport(diff));
            break;
          default:
            printTextDiff(diff, log, error);

            // Add AI summary if --ai flag and docs impact exists
            if (options.ai && diff.docsImpact && hasDocsImpact(diff)) {
              if (!isAIDocsAnalysisAvailable()) {
                log(
                  chalk.yellow(
                    '\n⚠ AI analysis unavailable (set OPENAI_API_KEY or ANTHROPIC_API_KEY)',
                  ),
                );
              } else {
                log(chalk.gray('\nGenerating AI summary...'));
                const impacts = diff.docsImpact.impactedFiles.flatMap((f) =>
                  f.references.map((r) => ({
                    file: f.file,
                    exportName: r.exportName,
                    changeType: r.changeType,
                    context: r.context,
                  })),
                );
                const summary = await generateImpactSummary(impacts);
                if (summary) {
                  log('');
                  log(chalk.bold('AI Summary'));
                  log(chalk.cyan(`  ${summary}`));
                }
              }
            }
            break;
        }

        // Check strict conditions
        if (strictOptions.has('regression') && diff.coverageDelta < 0) {
          error(chalk.red(`\nCoverage regressed by ${Math.abs(diff.coverageDelta)}%`));
          process.exitCode = 1;
          return;
        }

        if (strictOptions.has('drift') && diff.driftIntroduced > 0) {
          error(chalk.red(`\n${diff.driftIntroduced} new drift issue(s) introduced`));
          process.exitCode = 1;
          return;
        }

        if (strictOptions.has('docs-impact') && hasDocsImpact(diff)) {
          const summary = getDocsImpactSummary(diff);
          error(chalk.red(`\n${summary.totalIssues} docs issue(s) require attention`));
          process.exitCode = 1;
          return;
        }

        if (strictOptions.has('breaking') && diff.breaking.length > 0) {
          error(chalk.red(`\n${diff.breaking.length} breaking change(s) detected`));
          process.exitCode = 1;
          return;
        }

        if (strictOptions.has('undocumented') && diff.newUndocumented.length > 0) {
          error(chalk.red(`\n${diff.newUndocumented.length} new undocumented export(s)`));
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

/**
 * Collect multiple option values into an array
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Load markdown files from glob patterns
 */
async function loadMarkdownFiles(patterns: string[]): Promise<MarkdownDocFile[]> {
  const files: Array<{ path: string; content: string }> = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true });
    for (const filePath of matches) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        files.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return parseMarkdownFiles(files);
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

function printTextDiff(
  diff: SpecDiffWithDocs,
  log: typeof console.log,
  _error: typeof console.error,
): void {
  log('');
  log(chalk.bold('DocCov Diff Report'));
  log('─'.repeat(40));

  // Coverage section
  printCoverage(diff, log);

  // API Changes section (unified: classes, types, new exports)
  printAPIChanges(diff, log);

  // Docs Requiring Updates section (if markdown files were analyzed)
  if (diff.docsImpact) {
    printDocsRequiringUpdates(diff, log);
  }

  log('');
}

/**
 * Print coverage summary
 */
function printCoverage(diff: SpecDiffWithDocs, log: typeof console.log): void {
  const coverageColor =
    diff.coverageDelta > 0 ? chalk.green : diff.coverageDelta < 0 ? chalk.red : chalk.gray;
  const coverageSymbol = diff.coverageDelta > 0 ? '↑' : diff.coverageDelta < 0 ? '↓' : '→';
  const deltaStr = diff.coverageDelta > 0 ? `+${diff.coverageDelta}` : String(diff.coverageDelta);

  log('');
  log(chalk.bold('Coverage'));
  log(
    `  ${diff.oldCoverage}% ${coverageSymbol} ${diff.newCoverage}% ${coverageColor(`(${deltaStr}%)`)}`,
  );
}

/**
 * Print unified API Changes section
 */
function printAPIChanges(diff: SpecDiffWithDocs, log: typeof console.log): void {
  const hasChanges =
    diff.breaking.length > 0 ||
    diff.nonBreaking.length > 0 ||
    (diff.memberChanges && diff.memberChanges.length > 0);

  if (!hasChanges) return;

  log('');
  log(chalk.bold('API Changes'));

  // Group member changes by class
  const membersByClass = groupMemberChangesByClass(diff.memberChanges ?? []);

  // Get classes with member changes (these are the actionable breaking changes)
  const classesWithMembers = new Set(membersByClass.keys());

  // Print classes with member changes first (grouped by severity)
  for (const [className, changes] of membersByClass) {
    const categorized = diff.categorizedBreaking?.find((c) => c.id === className);
    const isHighSeverity = categorized?.severity === 'high';

    const label = isHighSeverity ? chalk.red(' [BREAKING]') : chalk.yellow(' [CHANGED]');
    log(chalk.cyan(`  ${className}`) + label);

    // Removals first with → suggestion
    const removed = changes.filter((c) => c.changeType === 'removed');
    for (const mc of removed) {
      const suggestion = mc.suggestion ? chalk.gray(` → ${mc.suggestion}`) : '';
      log(chalk.red(`    ✖ ${mc.memberName}()`) + suggestion);
    }

    // Signature changes with was/now
    const changed = changes.filter((c) => c.changeType === 'signature-changed');
    for (const mc of changed) {
      log(chalk.yellow(`    ~ ${mc.memberName}() signature changed`));
      if (mc.oldSignature && mc.newSignature && mc.oldSignature !== mc.newSignature) {
        log(chalk.gray(`        was: ${mc.oldSignature}`));
        log(chalk.gray(`        now: ${mc.newSignature}`));
      }
    }

    // Additions collapsed into single line
    const added = changes.filter((c) => c.changeType === 'added');
    if (added.length > 0) {
      const addedNames = added.map((a) => `${a.memberName}()`).join(', ');
      log(chalk.green(`    + ${addedNames}`));
    }
  }

  // Non-class breaking changes (types, interfaces, functions without member details)
  const nonClassBreaking = (diff.categorizedBreaking ?? []).filter(
    (c) => !classesWithMembers.has(c.id),
  );

  // Group by severity for display
  const typeChanges = nonClassBreaking.filter(
    (c) => c.kind === 'interface' || c.kind === 'type' || c.kind === 'enum',
  );
  const functionChanges = nonClassBreaking.filter((c) => c.kind === 'function');
  const otherChanges = nonClassBreaking.filter(
    (c) => !['interface', 'type', 'enum', 'function'].includes(c.kind),
  );

  // Print function changes (high priority)
  if (functionChanges.length > 0) {
    log('');
    log(chalk.red(`  Function Changes (${functionChanges.length}):`));
    for (const fc of functionChanges.slice(0, 3)) {
      const reason = fc.reason === 'removed' ? 'removed' : 'signature changed';
      log(chalk.red(`    ✖ ${fc.name} (${reason})`));
    }
    if (functionChanges.length > 3) {
      log(chalk.gray(`    ... and ${functionChanges.length - 3} more`));
    }
  }

  // Print type/interface changes (medium priority)
  if (typeChanges.length > 0) {
    log('');
    log(chalk.yellow(`  Type/Interface Changes (${typeChanges.length}):`));
    const typeNames = typeChanges.slice(0, 5).map((t) => t.name);
    log(chalk.yellow(`    ~ ${typeNames.join(', ')}${typeChanges.length > 5 ? ', ...' : ''}`));
  }

  // Print other changes (low priority)
  if (otherChanges.length > 0) {
    log('');
    log(chalk.gray(`  Other Changes (${otherChanges.length}):`));
    const otherNames = otherChanges.slice(0, 3).map((o) => o.name);
    log(chalk.gray(`    ${otherNames.join(', ')}${otherChanges.length > 3 ? ', ...' : ''}`));
  }

  // New exports with undocumented count inline
  if (diff.nonBreaking.length > 0) {
    const undocCount = diff.newUndocumented.length;
    const undocSuffix = undocCount > 0 ? chalk.yellow(` (${undocCount} undocumented)`) : '';

    log('');
    log(chalk.green(`  New Exports (${diff.nonBreaking.length})`) + undocSuffix);
    const exportNames = diff.nonBreaking.slice(0, 3);
    log(
      chalk.green(`    + ${exportNames.join(', ')}${diff.nonBreaking.length > 3 ? ', ...' : ''}`),
    );
  }

  // Drift summary (compact)
  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    log('');
    const parts: string[] = [];
    if (diff.driftIntroduced > 0) {
      parts.push(chalk.red(`+${diff.driftIntroduced} drift`));
    }
    if (diff.driftResolved > 0) {
      parts.push(chalk.green(`-${diff.driftResolved} resolved`));
    }
    log(`  Drift: ${parts.join(', ')}`);
  }
}

/**
 * Print docs requiring updates section
 */
function printDocsRequiringUpdates(diff: SpecDiffWithDocs, log: typeof console.log): void {
  if (!diff.docsImpact) return;

  const { impactedFiles, missingDocs, stats } = diff.docsImpact;

  log('');
  log(chalk.bold('Docs Requiring Updates'));
  log(chalk.gray(`  Scanned ${stats.filesScanned} files, ${stats.codeBlocksFound} code blocks`));

  if (impactedFiles.length === 0 && missingDocs.length === 0) {
    log(chalk.green('  ✓ No updates needed'));
    return;
  }

  // Sort files by number of issues (most impacted first)
  const sortedFiles = [...impactedFiles].sort((a, b) => b.references.length - a.references.length);

  // Separate actionable vs review (instantiation-only)
  // Actionable = has method-level refs OR export-level refs (function signature changes, removals)
  const actionableFiles: typeof sortedFiles = [];
  const instantiationOnlyFiles: typeof sortedFiles = [];

  for (const file of sortedFiles) {
    const hasActionableRefs = file.references.some(
      (r) => (r.memberName && !r.isInstantiation) || (!r.memberName && !r.isInstantiation),
    );
    if (hasActionableRefs) {
      actionableFiles.push(file);
    } else {
      instantiationOnlyFiles.push(file);
    }
  }

  // Print actionable files with details
  for (const file of actionableFiles.slice(0, 6)) {
    const filename = path.basename(file.file);
    const issueCount = file.references.length;

    log('');
    log(
      chalk.yellow(`  ${filename}`) +
        chalk.gray(` (${issueCount} issue${issueCount > 1 ? 's' : ''})`),
    );

    // Show actionable refs (method-level or export-level, not instantiations)
    const actionableRefs = file.references.filter((r) => !r.isInstantiation);
    for (const ref of actionableRefs.slice(0, 4)) {
      if (ref.memberName) {
        // Method-level change
        const action = ref.changeType === 'method-removed' ? '→' : '~';
        const hint =
          ref.replacementSuggestion ??
          (ref.changeType === 'method-changed' ? 'signature changed' : 'removed');
        log(chalk.gray(`    L${ref.line}: ${ref.memberName}() ${action} ${hint}`));
      } else {
        // Export-level change (function, type, etc.)
        const action = ref.changeType === 'removed' ? '→' : '~';
        const hint =
          ref.changeType === 'removed'
            ? 'removed'
            : ref.changeType === 'signature-changed'
              ? 'signature changed'
              : 'changed';
        log(chalk.gray(`    L${ref.line}: ${ref.exportName} ${action} ${hint}`));
      }
    }

    if (actionableRefs.length > 4) {
      log(chalk.gray(`    ... and ${actionableRefs.length - 4} more`));
    }
  }

  if (actionableFiles.length > 6) {
    log(chalk.gray(`  ... and ${actionableFiles.length - 6} more files with method changes`));
  }

  // Collapse instantiation-only files into summary
  if (instantiationOnlyFiles.length > 0) {
    log('');
    const fileNames = instantiationOnlyFiles.slice(0, 4).map((f) => path.basename(f.file));
    const suffix = instantiationOnlyFiles.length > 4 ? ', ...' : '';
    log(
      chalk.gray(`  ${instantiationOnlyFiles.length} file(s) with class instantiation to review:`),
    );
    log(chalk.gray(`    ${fileNames.join(', ')}${suffix}`));
  }

  // Missing docs summary - show both new and all undocumented
  const { allUndocumented } = diff.docsImpact;

  if (missingDocs.length > 0) {
    log('');
    log(chalk.yellow(`  New exports missing docs (${missingDocs.length}):`));
    const names = missingDocs.slice(0, 4);
    log(chalk.gray(`    ${names.join(', ')}${missingDocs.length > 4 ? ', ...' : ''}`));
  }

  // Show holistic undocumented count (excluding already shown new ones)
  if (allUndocumented && allUndocumented.length > 0) {
    const existingUndocumented = allUndocumented.filter((name) => !missingDocs.includes(name));
    log('');
    log(
      chalk.gray(
        `  Total undocumented exports: ${allUndocumented.length}/${stats.totalExports} (${Math.round((1 - allUndocumented.length / stats.totalExports) * 100)}% documented)`,
      ),
    );
    if (existingUndocumented.length > 0 && existingUndocumented.length <= 10) {
      log(
        chalk.gray(
          `    ${existingUndocumented.slice(0, 6).join(', ')}${existingUndocumented.length > 6 ? ', ...' : ''}`,
        ),
      );
    }
  }
}

/**
 * Group member changes by class name
 */
function groupMemberChangesByClass(memberChanges: MemberChange[]): Map<string, MemberChange[]> {
  const byClass = new Map<string, MemberChange[]>();
  for (const mc of memberChanges) {
    const list = byClass.get(mc.className) ?? [];
    list.push(mc);
    byClass.set(mc.className, list);
  }
  return byClass;
}

/**
 * Print GitHub Actions annotations format
 * These show inline in PR diffs and in the Actions summary
 */
function printGitHubAnnotations(diff: SpecDiffWithDocs, log: typeof console.log): void {
  // Coverage change annotation
  if (diff.coverageDelta !== 0) {
    const level = diff.coverageDelta < 0 ? 'warning' : 'notice';
    const sign = diff.coverageDelta > 0 ? '+' : '';
    log(
      `::${level} title=Coverage Change::Coverage ${diff.oldCoverage}% → ${diff.newCoverage}% (${sign}${diff.coverageDelta}%)`,
    );
  }

  // Breaking changes
  for (const breaking of diff.categorizedBreaking ?? []) {
    const level = breaking.severity === 'high' ? 'error' : 'warning';
    log(`::${level} title=Breaking Change::${breaking.name} - ${breaking.reason}`);
  }

  // Member-level changes (method removals, signature changes)
  for (const mc of diff.memberChanges ?? []) {
    if (mc.changeType === 'removed') {
      const suggestion = mc.suggestion ? ` ${mc.suggestion}` : '';
      log(
        `::warning title=Method Removed::${mc.className}.${mc.memberName}() removed.${suggestion}`,
      );
    } else if (mc.changeType === 'signature-changed') {
      log(
        `::warning title=Signature Changed::${mc.className}.${mc.memberName}() signature changed`,
      );
    }
  }

  // Docs impact annotations (with file and line info)
  if (diff.docsImpact) {
    for (const file of diff.docsImpact.impactedFiles) {
      for (const ref of file.references) {
        const level =
          ref.changeType === 'removed' || ref.changeType === 'method-removed' ? 'error' : 'warning';
        const name = ref.memberName ? `${ref.memberName}()` : ref.exportName;
        const changeDesc =
          ref.changeType === 'removed' || ref.changeType === 'method-removed'
            ? 'removed'
            : ref.changeType === 'signature-changed' || ref.changeType === 'method-changed'
              ? 'signature changed'
              : 'changed';
        const suggestion = ref.replacementSuggestion ? ` → ${ref.replacementSuggestion}` : '';

        log(
          `::${level} file=${file.file},line=${ref.line},title=API Change::${name} ${changeDesc}${suggestion}`,
        );
      }
    }

    // Missing docs annotations (new exports only)
    for (const name of diff.docsImpact.missingDocs) {
      log(`::notice title=Missing Documentation::New export ${name} needs documentation`);
    }

    // Summary annotation for total documentation coverage
    const { stats, allUndocumented } = diff.docsImpact;
    if (allUndocumented && allUndocumented.length > 0) {
      const docPercent = Math.round((1 - allUndocumented.length / stats.totalExports) * 100);
      log(
        `::notice title=Documentation Coverage::${stats.documentedExports}/${stats.totalExports} exports documented (${docPercent}%)`,
      );
    }
  }

  // New undocumented exports (not covered by docsImpact)
  if (!diff.docsImpact && diff.newUndocumented.length > 0) {
    for (const name of diff.newUndocumented) {
      log(`::notice title=Missing Documentation::New export ${name} needs documentation`);
    }
  }

  // Drift issues
  if (diff.driftIntroduced > 0) {
    log(`::warning title=Drift Detected::${diff.driftIntroduced} new drift issue(s) introduced`);
  }
}

/**
 * Generate an HTML report
 */
function generateHTMLReport(diff: SpecDiffWithDocs): string {
  const coverageClass =
    diff.coverageDelta > 0 ? 'positive' : diff.coverageDelta < 0 ? 'negative' : 'neutral';
  const coverageSign = diff.coverageDelta > 0 ? '+' : '';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocCov Diff Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f0f6fc; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 0.75rem; color: #f0f6fc; border-bottom: 1px solid #30363d; padding-bottom: 0.5rem; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; }
    .metric { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; }
    .metric-label { color: #8b949e; }
    .metric-value { font-weight: 600; }
    .positive { color: #3fb950; }
    .negative { color: #f85149; }
    .neutral { color: #8b949e; }
    .warning { color: #d29922; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
    .badge-breaking { background: #f8514933; color: #f85149; }
    .badge-changed { background: #d2992233; color: #d29922; }
    .badge-added { background: #3fb95033; color: #3fb950; }
    .file-item { padding: 0.5rem; margin: 0.25rem 0; background: #0d1117; border-radius: 4px; }
    .file-name { font-family: monospace; font-size: 0.9rem; }
    .ref-list { margin-top: 0.5rem; padding-left: 1rem; font-size: 0.85rem; color: #8b949e; }
    .ref-item { margin: 0.25rem 0; }
    ul { list-style: none; }
    li { padding: 0.25rem 0; }
    code { font-family: monospace; background: #0d1117; padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 DocCov Diff Report</h1>

    <div class="card">
      <div class="metric">
        <span class="metric-label">Coverage</span>
        <span class="metric-value ${coverageClass}">${diff.oldCoverage}% → ${diff.newCoverage}% (${coverageSign}${diff.coverageDelta}%)</span>
      </div>
      <div class="metric">
        <span class="metric-label">Breaking Changes</span>
        <span class="metric-value ${diff.breaking.length > 0 ? 'negative' : 'neutral'}">${diff.breaking.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">New Exports</span>
        <span class="metric-value positive">${diff.nonBreaking.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Undocumented</span>
        <span class="metric-value ${diff.newUndocumented.length > 0 ? 'warning' : 'neutral'}">${diff.newUndocumented.length}</span>
      </div>
    </div>`;

  // Breaking changes
  if (diff.breaking.length > 0) {
    html += `
    <h2>Breaking Changes</h2>
    <div class="card">
      <ul>`;
    for (const item of diff.categorizedBreaking ?? []) {
      const badgeClass = item.severity === 'high' ? 'badge-breaking' : 'badge-changed';
      html += `
        <li><code>${item.name}</code> <span class="badge ${badgeClass}">${item.reason}</span></li>`;
    }
    html += `
      </ul>
    </div>`;
  }

  // Member changes
  if (diff.memberChanges && diff.memberChanges.length > 0) {
    html += `
    <h2>Member Changes</h2>
    <div class="card">
      <ul>`;
    for (const mc of diff.memberChanges) {
      const badgeClass =
        mc.changeType === 'removed'
          ? 'badge-breaking'
          : mc.changeType === 'added'
            ? 'badge-added'
            : 'badge-changed';
      const suggestion = mc.suggestion ? ` → ${mc.suggestion}` : '';
      html += `
        <li><code>${mc.className}.${mc.memberName}()</code> <span class="badge ${badgeClass}">${mc.changeType}</span>${suggestion}</li>`;
    }
    html += `
      </ul>
    </div>`;
  }

  // Docs impact
  if (diff.docsImpact && diff.docsImpact.impactedFiles.length > 0) {
    html += `
    <h2>Documentation Impact</h2>
    <div class="card">`;
    for (const file of diff.docsImpact.impactedFiles.slice(0, 10)) {
      const filename = path.basename(file.file);
      html += `
      <div class="file-item">
        <div class="file-name">📄 ${filename} <span class="neutral">(${file.references.length} issue${file.references.length > 1 ? 's' : ''})</span></div>
        <div class="ref-list">`;
      for (const ref of file.references.slice(0, 5)) {
        const name = ref.memberName ? `${ref.memberName}()` : ref.exportName;
        const change =
          ref.changeType === 'removed' || ref.changeType === 'method-removed'
            ? 'removed'
            : 'signature changed';
        html += `
          <div class="ref-item">Line ${ref.line}: <code>${name}</code> ${change}</div>`;
      }
      if (file.references.length > 5) {
        html += `
          <div class="ref-item neutral">... and ${file.references.length - 5} more</div>`;
      }
      html += `
        </div>
      </div>`;
    }
    html += `
    </div>`;
  }

  // Missing docs - show both new and all undocumented
  const hasNewUndocumented = diff.newUndocumented.length > 0;
  const hasAllUndocumented =
    diff.docsImpact?.allUndocumented && diff.docsImpact.allUndocumented.length > 0;

  if (hasNewUndocumented || hasAllUndocumented) {
    html += `
    <h2>Missing Documentation</h2>
    <div class="card">`;

    // New undocumented exports
    if (hasNewUndocumented) {
      html += `
      <p class="warning">New exports missing docs (${diff.newUndocumented.length}):</p>
      <ul>`;
      for (const name of diff.newUndocumented.slice(0, 10)) {
        html += `
        <li><code>${name}</code></li>`;
      }
      if (diff.newUndocumented.length > 10) {
        html += `
        <li class="neutral">... and ${diff.newUndocumented.length - 10} more</li>`;
      }
      html += `
      </ul>`;
    }

    // Total documentation coverage
    if (diff.docsImpact?.stats) {
      const { stats, allUndocumented } = diff.docsImpact;
      const docPercent = Math.round(
        (1 - (allUndocumented?.length ?? 0) / stats.totalExports) * 100,
      );
      html += `
      <div class="metric" style="margin-top: 1rem; border-top: 1px solid #30363d; padding-top: 1rem;">
        <span class="metric-label">Total Documentation Coverage</span>
        <span class="metric-value ${docPercent >= 80 ? 'positive' : docPercent >= 50 ? 'warning' : 'negative'}">${stats.documentedExports}/${stats.totalExports} (${docPercent}%)</span>
      </div>`;
    }

    html += `
    </div>`;
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}
