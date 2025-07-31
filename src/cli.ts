#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { extractPackageSpec } from './extractor';
import { findEntryPoint, findPackageInMonorepo } from './utils/package-utils';

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
        console.log(`Found package at ${path.relative(options.cwd, packageDir)}`);
      }

      // Auto-detect entry point if not provided
      if (!entryFile) {
        entryFile = await findEntryPoint(targetDir, true); // Always prefer source
        console.log(`Auto-detected entry point: ${path.relative(targetDir, entryFile)}`);
      } else {
        // Resolve entry file relative to target directory
        entryFile = path.resolve(targetDir, entryFile);
      }

      console.log(`Generating OpenPkg spec...`);
      
      const spec = await extractPackageSpec(entryFile, targetDir);
      
      // Determine output path
      const outputPath = path.resolve(targetDir, options.output);
      fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
      
      console.log(`✓ Generated ${path.relative(process.cwd(), outputPath)}`);
      console.log(`  ${spec.exports.length} exports`);
      console.log(`  ${spec.types?.length || 0} types`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
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