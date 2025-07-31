#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { extractPackageSpec } from './extractor';
import { findEntryPoint, findPackageInMonorepo } from './utils/package-utils';
import { detectBuildStatus, shouldWarnAboutBuild, formatBuildWarning } from './utils/build-detection';

const program = new Command();

program
  .name('openpkg')
  .description('Generate OpenPkg specification for TypeScript packages')
  .version('1.0.0');

// Generate command
program
  .command('generate [entry]')
  .description('Generate OpenPkg specification')
  .option('-o, --output <file>', 'Output file', 'openpkg.json')
  .option('-p, --package <name>', 'Target package name (for monorepos)')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .option('--skip-build-check', 'Skip build status warnings')
  .option('-y, --yes', 'Skip all prompts and use defaults')
  .action(async (entry, options) => {
    try {
      let targetDir = options.cwd;
      let entryFile = entry;

      // Handle monorepo package targeting
      if (options.package) {
        const packageDir = await findPackageInMonorepo(options.cwd, options.package);
        if (!packageDir) {
          throw new Error(`Package "${options.package}" not found in monorepo`);
        }
        targetDir = packageDir;
        console.log(chalk.gray(`Found package at ${path.relative(options.cwd, packageDir)}`));
      }

      // Auto-detect entry point if not provided
      if (!entryFile) {
        entryFile = await findEntryPoint(targetDir, true); // Always prefer source
        console.log(chalk.gray(`Auto-detected entry point: ${path.relative(targetDir, entryFile)}`));
      } else {
        // Resolve entry file relative to target directory
        entryFile = path.resolve(targetDir, entryFile);
      }

      // Check build status unless skipped
      if (!options.skipBuildCheck) {
        const buildStatus = detectBuildStatus(targetDir);
        
        if (shouldWarnAboutBuild(buildStatus)) {
          console.warn(chalk.yellow(formatBuildWarning(buildStatus)));
          
          // Ask user if they want to continue (unless -y flag is used)
          if (!options.yes) {
            const shouldContinue = await confirm({
              message: 'Do you want to continue anyway?',
              default: true
            });
            
            if (!shouldContinue) {
              console.log(chalk.gray('\nBuild your package first, then run openpkg generate again.'));
              process.exit(0);
            }
          }
        }
      }

      const spinner = ora('Generating OpenPkg spec...').start();
      
      let spec;
      try {
        spec = await extractPackageSpec(entryFile, targetDir);
        spinner.succeed('Generated OpenPkg spec');
      } catch (error) {
        spinner.fail('Failed to generate spec');
        throw error;
      }
      
      // Determine output path
      const outputPath = path.resolve(targetDir, options.output);
      fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
      
      console.log(chalk.green(`✓ Generated ${path.relative(process.cwd(), outputPath)}`));
      console.log(chalk.gray(`  ${spec.exports.length} exports`));
      console.log(chalk.gray(`  ${spec.types?.length || 0} types`));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Make generate the default command if no subcommand is provided
program
  .command('*', { hidden: true })
  .action(() => {
    program.outputHelp();
  });

program.parse();