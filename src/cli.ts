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

// Analyze command
program
  .command('analyze <url>')
  .description('Analyze TypeScript code from a URL (Studio feature)')
  .option('--debug', 'Show debug output')
  .action(async (url, options) => {
    try {
      // Check if user is authenticated (for now, just warn)
      console.warn(chalk.yellow('⚠️  You are not authenticated with OpenPkg Studio. Some features may be limited.'));
      
      const spinner = ora(`Fetching ${path.basename(url)}...`).start();
      
      try {
        // Call Studio API
        const response = await fetch('http://localhost:3000/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ source: url }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          spinner.fail('Failed to analyze');
          
          if (options.debug) {
            console.error(chalk.gray('\nDebug info:'));
            console.error(chalk.gray(`Status: ${response.status}`));
            console.error(chalk.gray(`Response: ${JSON.stringify(data, null, 2)}`));
          }
          
          // Handle specific error codes
          if (data.error) {
            switch (data.error.code) {
              case 'FILE_NOT_FOUND':
                console.error(chalk.red('Error: File not found at the specified URL'));
                break;
              case 'INVALID_URL':
                console.error(chalk.red('Error: Invalid GitHub URL format'));
                break;
              case 'TIMEOUT':
                console.error(chalk.red('Error: Request timed out'));
                break;
              case 'NETWORK_ERROR':
                console.error(chalk.red('Error: Network error occurred'));
                break;
              default:
                console.error(chalk.red(`Error: ${data.error.message}`));
            }
          } else {
            console.error(chalk.red('Error: Unknown error occurred'));
          }
          
          process.exit(1);
        }
        
        spinner.succeed('Fetched successfully');
        
        if (options.debug) {
          console.log(chalk.gray('\nDebug info:'));
          console.log(chalk.gray(`Files analyzed: ${data.metadata.filesAnalyzed}`));
          console.log(chalk.gray(`Duration: ${data.metadata.duration}ms`));
          console.log(chalk.gray(`Cached: ${data.metadata.cached}`));
          console.log();
        }
        
        // Display the content
        console.log(data.content);
        
      } catch (error) {
        spinner.fail('Failed to connect to OpenPkg Studio');
        
        if (options.debug) {
          console.error(chalk.gray('\nDebug info:'));
          console.error(error);
        }
        
        console.error(chalk.red('Error: Could not connect to OpenPkg Studio API'));
        console.error(chalk.gray('Make sure the Studio server is running on http://localhost:3000'));
        process.exit(1);
      }
      
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