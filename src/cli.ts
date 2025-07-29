#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { extractPackageSpec } from './extractor';

const program = new Command();

program
  .name('openpkg')
  .description('Generate OpenPkg specification for TypeScript packages')
  .argument('[entry]', 'Entry file (default: index.ts)', 'index.ts')
  .option('-o, --output <file>', 'Output file', 'openpkg.json')
  .action((entry, options) => {
    try {
      console.log(`Extracting from ${entry}...`);
      
      const spec = extractPackageSpec(entry);
      
      fs.writeFileSync(options.output, JSON.stringify(spec, null, 2));
      
      console.log(`✓ Generated ${options.output}`);
      console.log(`  ${spec.exports.length} exports`);
      console.log(`  ${spec.types?.length || 0} types`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();