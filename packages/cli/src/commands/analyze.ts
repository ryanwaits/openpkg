import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { OpenPkg, type OpenPkgSpec } from 'openpkg-sdk';
import ora from 'ora';
import { collectGuardrailInsights } from '../utils/guardrails';

export interface AnalyzeCommandDependencies {
  createOpenPkg?: (options?: unknown) => Pick<OpenPkg, 'analyzeFileWithDiagnostics'>;
  spinner?: (text: string) => ora.Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<AnalyzeCommandDependencies> = {
  createOpenPkg: () => new OpenPkg(),
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

export function registerAnalyzeCommand(
  program: Command,
  dependencies: AnalyzeCommandDependencies = {},
): void {
  const { createOpenPkg, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('analyze <entry>')
    .description('Analyze a local TypeScript file and print a summary')
    .option('-o, --output <file>', 'Write the generated OpenPkg spec to a file')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--show <items>', 'Items to display: spec,summary (comma-separated)', 'summary')
    .action(async (entry, options) => {
      try {
        const cwd = options.cwd as string;
        const showItems = String(options.show)
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        const validShowItems = ['spec', 'summary'];
        const invalid = showItems.filter((item) => !validShowItems.includes(item));
        if (invalid.length > 0) {
          error(chalk.red(`Invalid --show values: ${invalid.join(', ')}`));
          error(chalk.gray(`Valid options: ${validShowItems.join(', ')}`));
          process.exitCode = 1;
          return;
        }

        const entryPath = path.resolve(cwd, entry);
        if (!fs.existsSync(entryPath)) {
          error(chalk.red(`File not found: ${entryPath}`));
          process.exitCode = 1;
          return;
        }

        const spinnerInstance = spinner('Analyzing...');
        spinnerInstance.start();

        let spec: OpenPkgSpec;
        let analysisResult: Awaited<ReturnType<OpenPkg['analyzeFileWithDiagnostics']>> | undefined;
        try {
          const openpkg = createOpenPkg();
          analysisResult = await openpkg.analyzeFileWithDiagnostics(entryPath);
          spec = analysisResult.spec;
          spinnerInstance.succeed('Analysis complete');
        } catch (analysisError) {
          spinnerInstance.fail('Failed to analyze file');
          throw analysisError;
        }

        if (options.output) {
          const outputPath = path.resolve(cwd, options.output as string);
          fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
          log(chalk.green(`✓ Spec written to ${path.relative(process.cwd(), outputPath)}`));
        }

        if (showItems.includes('summary')) {
          log('');
          log(chalk.bold('Summary'));
          log(`• Exports: ${spec.exports.length}`);
          log(`• Types: ${spec.types?.length ?? 0}`);
        }

        if (showItems.includes('spec')) {
          log('');
          log(JSON.stringify(spec, null, 2));
        }

        if (analysisResult) {
          const guardrails = collectGuardrailInsights({
            cwd,
            entryPath,
            analysis: analysisResult,
          });

          if (guardrails.messages.length > 0) {
            log('');
            log(chalk.bold('Guardrails'));
            for (const message of guardrails.messages) {
              const icon =
                message.severity === 'error'
                  ? chalk.red('✖')
                  : message.severity === 'warning'
                    ? chalk.yellow('⚠')
                    : chalk.cyan('ℹ');
              log(`${icon} ${message.message}`);
              if (message.suggestion) {
                log(chalk.gray(`   ↳ ${message.suggestion}`));
              }
            }
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
