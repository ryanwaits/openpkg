import * as fs from 'node:fs';
import * as path from 'node:path';
import { DocCov } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { computeStats, renderHtml, renderMarkdown } from '../reports';
import { findEntryPoint, findPackageInMonorepo } from '../utils/package-utils';

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
    .action(async (entry, options) => {
      try {
        let spec: OpenPkg;

        if (options.spec) {
          const specPath = path.resolve(options.cwd, options.spec);
          spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        } else {
          let targetDir = options.cwd;
          let entryFile = entry as string | undefined;

          if (options.package) {
            const packageDir = await findPackageInMonorepo(options.cwd, options.package);
            if (!packageDir) throw new Error(`Package "${options.package}" not found`);
            targetDir = packageDir;
          }

          if (!entryFile) {
            entryFile = await findEntryPoint(targetDir, true);
          } else {
            entryFile = path.resolve(targetDir, entryFile);
          }

          const spinner = ora('Analyzing...').start();
          const doccov = new DocCov({ resolveExternalTypes: true });
          const result = await doccov.analyzeFileWithDiagnostics(entryFile);
          spinner.succeed('Analysis complete');
          spec = result.spec;
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
