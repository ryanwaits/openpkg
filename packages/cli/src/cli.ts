#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerCheckCommand } from './commands/check';
import { registerDiffCommand } from './commands/diff';
import { registerInfoCommand } from './commands/info';
import { registerInitCommand } from './commands/init';
import { registerSpecCommand } from './commands/spec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('doccov')
  .description('DocCov - Documentation coverage and drift detection for TypeScript')
  .version(packageJson.version);

// Core commands
registerCheckCommand(program);
registerInfoCommand(program);
registerSpecCommand(program);

// Utility commands
registerDiffCommand(program);
registerInitCommand(program);

program.command('*', { hidden: true }).action(() => {
  program.outputHelp();
});

program.parseAsync().catch(() => {
  // Errors are already logged by commands, just exit silently
  process.exit(1);
});
