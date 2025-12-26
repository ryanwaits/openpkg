#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerBuildCommand } from './cli/build';
import { registerDevCommand } from './cli/dev';
import { registerGenerateCommand } from './cli/generate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let version = '0.0.1';
try {
  const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
  version = packageJson.version;
} catch {
  // Fallback if package.json not found
}

const program = new Command();

program
  .name('openpkg-docs')
  .description('Generate API documentation from OpenPkg specs')
  .version(version)
  .option('-c, --config <path>', 'Config file path')
  .option('-v, --verbose', 'Verbose output');

// Commands
registerBuildCommand(program);
registerGenerateCommand(program);
registerDevCommand(program);

program.command('*', { hidden: true }).action(() => {
  program.outputHelp();
});

program.parseAsync().catch(() => {
  process.exit(1);
});
