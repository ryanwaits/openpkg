#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerCheckCommand } from './commands/check';
import { registerDiffCommand } from './commands/diff';
import { registerFixCommand } from './commands/fix';
import { registerGenerateCommand } from './commands/generate';
import { registerInitCommand } from './commands/init';
import { registerReportCommand } from './commands/report';
import { registerScanCommand } from './commands/scan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('doccov')
  .description('DocCov - Documentation coverage and drift detection for TypeScript')
  .version(packageJson.version);

registerGenerateCommand(program);
registerCheckCommand(program);
registerDiffCommand(program);
registerFixCommand(program);
registerInitCommand(program);
registerReportCommand(program);
registerScanCommand(program);

program.command('*', { hidden: true }).action(() => {
  program.outputHelp();
});

program.parseAsync().catch(() => {
  // Errors are already logged by commands, just exit silently
  process.exit(1);
});
