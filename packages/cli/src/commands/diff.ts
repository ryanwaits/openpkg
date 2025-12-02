import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  diffSpecWithDocs,
  getDocsImpactSummary,
  hasDocsImpact,
  parseMarkdownFiles,
  type MarkdownDocFile,
  type SpecDiffWithDocs,
} from '@doccov/sdk';
import { type OpenPkg, type SpecDiff } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { glob } from 'glob';
import { loadDocCovConfig } from '../config';
import {
  generateImpactSummary,
  isAIDocsAnalysisAvailable,
} from '../utils/docs-impact-ai';

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
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for impact', collect, [])
    .option('--fail-on-docs-impact', 'Exit with error if docs need updates')
    .option('--ai', 'Use AI for deeper analysis and fix suggestions')
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
        const format = (options.output as OutputFormat) ?? 'text';

        if (format === 'json') {
          log(JSON.stringify(diff, null, 2));
        } else {
          printTextDiff(diff, log, error);

          // Add AI summary if --ai flag and docs impact exists
          if (options.ai && diff.docsImpact && hasDocsImpact(diff)) {
            if (!isAIDocsAnalysisAvailable()) {
              log(chalk.yellow('\n⚠ AI analysis unavailable (set OPENAI_API_KEY or ANTHROPIC_API_KEY)'));
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

        if (options.failOnDocsImpact && hasDocsImpact(diff)) {
          const summary = getDocsImpactSummary(diff);
          error(chalk.red(`\n${summary.totalIssues} docs issue(s) require attention`));
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

  // Member-level changes (methods added/removed/changed on classes)
  if (diff.memberChanges && diff.memberChanges.length > 0) {
    log('');
    log(chalk.bold('Member Changes'));

    // Group by class
    const byClass = new Map<string, typeof diff.memberChanges>();
    for (const mc of diff.memberChanges) {
      const list = byClass.get(mc.className) ?? [];
      list.push(mc);
      byClass.set(mc.className, list);
    }

    for (const [className, changes] of byClass) {
      log(chalk.cyan(`  ${className}:`));
      const removed = changes.filter((c) => c.changeType === 'removed');
      const added = changes.filter((c) => c.changeType === 'added');
      const changed = changes.filter((c) => c.changeType === 'signature-changed');

      for (const mc of removed.slice(0, 3)) {
        const suggestion = mc.suggestion ? ` (${mc.suggestion})` : '';
        log(chalk.red(`    - ${mc.memberName}()${suggestion}`));
      }
      for (const mc of added.slice(0, 3)) {
        log(chalk.green(`    + ${mc.memberName}()`));
      }
      for (const mc of changed.slice(0, 3)) {
        log(chalk.yellow(`    ~ ${mc.memberName}() signature changed`));
      }

      const total = removed.length + added.length + changed.length;
      const shown = Math.min(removed.length, 3) + Math.min(added.length, 3) + Math.min(changed.length, 3);
      if (total > shown) {
        log(chalk.gray(`    ... and ${total - shown} more member change(s)`));
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

  // Docs impact (if markdown files were analyzed)
  if (diff.docsImpact) {
    log('');
    log(chalk.bold('Docs Impact'));

    const { impactedFiles, missingDocs, stats } = diff.docsImpact;

    log(chalk.gray(`  Scanned ${stats.filesScanned} file(s), ${stats.codeBlocksFound} code block(s)`));

    if (impactedFiles.length > 0) {
      log('');
      log(chalk.yellow(`  ${impactedFiles.length} file(s) need updates:`));
      for (const file of impactedFiles.slice(0, 10)) {
        log(chalk.yellow(`    📄 ${file.file}`));
        for (const ref of file.references.slice(0, 5)) {
          // Format based on whether this is a member-level or export-level change
          if (ref.memberName) {
            // Member-level change (e.g., method removed/changed)
            const changeLabel =
              ref.changeType === 'method-removed'
                ? 'removed'
                : ref.changeType === 'method-changed'
                  ? 'signature changed'
                  : ref.changeType === 'method-deprecated'
                    ? 'deprecated'
                    : 'changed';
            log(chalk.gray(`       Line ${ref.line}: ${ref.memberName}() ${changeLabel}`));
            if (ref.replacementSuggestion) {
              log(chalk.cyan(`         → ${ref.replacementSuggestion}`));
            }
          } else if (ref.isInstantiation) {
            // Class instantiation - lower priority
            log(chalk.gray(`       Line ${ref.line}: new ${ref.exportName}() (class changed)`));
          } else {
            // Export-level change (fallback)
            const changeLabel =
              ref.changeType === 'signature-changed'
                ? 'signature changed'
                : ref.changeType === 'removed'
                  ? 'removed'
                  : 'deprecated';
            log(chalk.gray(`       Line ${ref.line}: ${ref.exportName} (${changeLabel})`));
          }
        }
        if (file.references.length > 5) {
          log(chalk.gray(`       ... and ${file.references.length - 5} more reference(s)`));
        }
      }
      if (impactedFiles.length > 10) {
        log(chalk.gray(`    ... and ${impactedFiles.length - 10} more file(s)`));
      }
    }

    if (missingDocs.length > 0) {
      log('');
      log(chalk.yellow(`  ${missingDocs.length} new export(s) missing docs:`));
      for (const name of missingDocs.slice(0, 5)) {
        log(chalk.yellow(`    • ${name}`));
      }
      if (missingDocs.length > 5) {
        log(chalk.gray(`    ... and ${missingDocs.length - 5} more`));
      }
    }

    if (impactedFiles.length === 0 && missingDocs.length === 0) {
      log(chalk.green('  ✓ No docs impact detected'));
    }
  }

  log('');
}
