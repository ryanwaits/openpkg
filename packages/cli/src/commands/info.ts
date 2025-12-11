import { DocCov, enrichSpec, NodeFileSystem, resolveTarget } from '@doccov/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';
import { computeStats } from '../reports';

export function registerInfoCommand(program: Command): void {
  program
    .command('info [entry]')
    .description('Show brief documentation coverage summary')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .action(async (entry, options) => {
      try {
        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { entryFile } = resolved;
        const resolveExternalTypes = !options.skipResolve;

        // Run analysis
        const doccov = new DocCov({
          resolveExternalTypes,
        });
        const specResult = await doccov.analyzeFileWithDiagnostics(entryFile);

        if (!specResult) {
          throw new Error('Failed to analyze documentation coverage.');
        }

        // Enrich and compute stats
        const spec = enrichSpec(specResult.spec);
        const stats = computeStats(spec);

        // Output summary
        console.log('');
        console.log(chalk.bold(`${stats.packageName}@${stats.version}`));
        console.log('');
        console.log(`  Exports:    ${chalk.bold(stats.totalExports.toString())}`);
        console.log(`  Coverage:   ${chalk.bold(`${stats.coverageScore}%`)}`);
        console.log(`  Drift:      ${chalk.bold(`${stats.driftScore}%`)}`);
        console.log('');
      } catch (err) {
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
