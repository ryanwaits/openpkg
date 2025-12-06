import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DocCov,
  NodeFileSystem,
  resolveTarget,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { computeStats, renderHtml, renderMarkdown } from '../reports';

type OutputFormat = 'markdown' | 'html' | 'json';

export function registerReportCommand(program: Command): void {
  program
    .command('report [entry]')
    .description('Generate a documentation coverage report')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--spec <file>', 'Use existing openpkg.json instead of analyzing')
    .option('--output <format>', 'Output format: markdown, html, json', 'markdown')
    .option('--out <file>', 'Write to file instead of stdout')
    .option('--limit <n>', 'Max exports to show in tables', '20')
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .action(async (entry, options) => {
      try {
        let spec: OpenPkg;

        if (options.spec) {
          const specPath = path.resolve(options.cwd, options.spec);
          spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        } else {
          // Resolve target directory and entry point
          const fileSystem = new NodeFileSystem(options.cwd);
          const resolved = await resolveTarget(fileSystem, {
            cwd: options.cwd,
            package: options.package,
            entry: entry as string | undefined,
          });

          const { entryFile } = resolved;

          // Use simple text indicator for CPU-intensive analysis (ora can't animate during blocking operations)
          process.stdout.write(chalk.cyan('> Analyzing...\n'));

          try {
            const resolveExternalTypes = !options.skipResolve;
            const doccov = new DocCov({ resolveExternalTypes });
            const result = await doccov.analyzeFileWithDiagnostics(entryFile);
            process.stdout.write(chalk.green('✓ Analysis complete\n'));
            spec = result.spec;
          } catch (analysisError) {
            process.stdout.write(chalk.red('✗ Analysis failed\n'));
            throw analysisError;
          }
        }

        const stats = computeStats(spec);
        const format = options.output as OutputFormat;
        const limit = parseInt(options.limit, 10) || 20;

        let output: string;
        if (format === 'json') {
          output = JSON.stringify(stats, null, 2);
        } else if (format === 'html') {
          output = renderHtml(stats, { limit });
        } else {
          output = renderMarkdown(stats, { limit });
        }

        if (options.out) {
          const outPath = path.resolve(options.cwd, options.out);
          fs.writeFileSync(outPath, output);
          console.log(chalk.green(`Report written to ${outPath}`));
        } else {
          console.log(output);
        }
      } catch (err) {
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });
}
