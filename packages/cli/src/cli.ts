#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerCheckCommand } from './commands/check';
import { registerGenerateCommand } from './commands/generate';
import { registerInitCommand } from './commands/init';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('openpkg')
  .description('Generate OpenPkg specification for TypeScript packages')
  .version(packageJson.version);

registerGenerateCommand(program);
registerCheckCommand(program);
registerInitCommand(program);

program.command('*', { hidden: true }).action(() => {
  program.outputHelp();
});

program.parseAsync();
