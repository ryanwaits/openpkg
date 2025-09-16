import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { OpenPkg, type openPkgSchema } from 'openpkg-sdk';
import ora from 'ora';
import type { z } from 'zod';
import { findEntryPoint, findPackageInMonorepo } from '../utils/package-utils';

export interface GenerateCommandDependencies {
  createOpenPkg?: (options: ConstructorParameters<typeof OpenPkg>[0]) => Pick<OpenPkg, 'analyzeFile'>;
  writeFileSync?: typeof fs.writeFileSync;
  spinner?: (text: string) => ora.Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<GenerateCommandDependencies> = {
  createOpenPkg: (options) => new OpenPkg(options),
  writeFileSync: fs.writeFileSync,
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

export function registerGenerateCommand(
  program: Command,
  dependencies: GenerateCommandDependencies = {},
): void {
  const { createOpenPkg, writeFileSync, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('generate [entry]')
    .description('Generate OpenPkg specification')
    .option('-o, --output <file>', 'Output file', 'openpkg.json')
    .option('-p, --package <name>', 'Target package name (for monorepos)')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--no-external-types', 'Skip external type resolution from node_modules')
    .option('-y, --yes', 'Skip all prompts and use defaults')
    .action(async (entry, options) => {
      try {
        let targetDir = options.cwd;
        let entryFile = entry;

        if (options.package) {
          const packageDir = await findPackageInMonorepo(options.cwd, options.package);
          if (!packageDir) {
            throw new Error(`Package "${options.package}" not found in monorepo`);
          }
          targetDir = packageDir;
          log(chalk.gray(`Found package at ${path.relative(options.cwd, packageDir)}`));
        }

        if (!entryFile) {
          entryFile = await findEntryPoint(targetDir, true);
          log(chalk.gray(`Auto-detected entry point: ${path.relative(targetDir, entryFile)}`));
        } else {
          entryFile = path.resolve(targetDir, entryFile);
        }

        const resolveExternalTypes = options.externalTypes !== false;

        const spinnerInstance = spinner('Generating OpenPkg spec...');
        spinnerInstance.start();

        let spec: z.infer<typeof openPkgSchema> | undefined;
        try {
          const openpkg = createOpenPkg({
            resolveExternalTypes,
          });
          spec = await openpkg.analyzeFile(entryFile);
          spinnerInstance.succeed('Generated OpenPkg spec');
        } catch (generationError) {
          spinnerInstance.fail('Failed to generate spec');
          throw generationError;
        }

        const outputPath = path.resolve(targetDir, options.output);
        writeFileSync(outputPath, JSON.stringify(spec, null, 2));

        log(chalk.green(`✓ Generated ${path.relative(process.cwd(), outputPath)}`));
        log(chalk.gray(`  ${spec.exports.length} exports`));
        log(chalk.gray(`  ${spec.types?.length || 0} types`));
      } catch (commandError) {
        error(chalk.red('Error:'), commandError instanceof Error ? commandError.message : commandError);
        process.exit(1);
      }
    });
}
