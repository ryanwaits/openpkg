import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { DOCCOV_CONFIG_FILENAMES } from '../config';

export interface InitCommandDependencies {
  fileExists?: typeof fs.existsSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

type ConfigFormat = 'auto' | 'mjs' | 'js' | 'cjs';

type PackageType = 'module' | 'commonjs' | undefined;

const defaultDependencies: Required<InitCommandDependencies> = {
  fileExists: fs.existsSync,
  writeFileSync: fs.writeFileSync,
  readFileSync: fs.readFileSync,
  log: console.log,
  error: console.error,
};

export function registerInitCommand(
  program: Command,
  dependencies: InitCommandDependencies = {},
): void {
  const { fileExists, writeFileSync, readFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('init')
    .description('Create a DocCov configuration file')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--format <format>', 'Config format: auto, mjs, js, cjs', 'auto')
    .action((options) => {
      const cwd = path.resolve(options.cwd as string);

      const formatOption = String(options.format ?? 'auto').toLowerCase();
      if (!isValidFormat(formatOption)) {
        error(chalk.red(`Invalid format "${formatOption}". Use auto, mjs, js, or cjs.`));
        process.exitCode = 1;
        return;
      }

      const existing = findExistingConfig(cwd, fileExists);
      if (existing) {
        error(
          chalk.red(
            `A DocCov config already exists at ${path.relative(cwd, existing) || './doccov.config.*'}.`,
          ),
        );
        process.exitCode = 1;
        return;
      }

      const packageType = detectPackageType(cwd, fileExists, readFileSync);
      const targetFormat = resolveFormat(formatOption as ConfigFormat, packageType);

      if (targetFormat === 'js' && packageType !== 'module') {
        log(
          chalk.yellow(
            'Package is not marked as "type": "module"; creating doccov.config.js may require enabling ESM.',
          ),
        );
      }

      const fileName = `doccov.config.${targetFormat}`;
      const outputPath = path.join(cwd, fileName);

      if (fileExists(outputPath)) {
        error(chalk.red(`Cannot create ${fileName}; file already exists.`));
        process.exitCode = 1;
        return;
      }

      const template = buildTemplate(targetFormat);
      writeFileSync(outputPath, template, { encoding: 'utf8' });

      log(chalk.green(`✓ Created ${path.relative(process.cwd(), outputPath)}`));
    });
}

const isValidFormat = (value: string): value is ConfigFormat => {
  return value === 'auto' || value === 'mjs' || value === 'js' || value === 'cjs';
};

const findExistingConfig = (cwd: string, fileExists: typeof fs.existsSync): string | null => {
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    for (const candidate of DOCCOV_CONFIG_FILENAMES) {
      const candidatePath = path.join(current, candidate);
      if (fileExists(candidatePath)) {
        return candidatePath;
      }
    }

    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return null;
};

const detectPackageType = (
  cwd: string,
  fileExists: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): PackageType => {
  const packageJsonPath = findNearestPackageJson(cwd, fileExists);
  if (!packageJsonPath) {
    return undefined;
  }

  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { type?: string };
    if (parsed.type === 'module') {
      return 'module';
    }
    if (parsed.type === 'commonjs') {
      return 'commonjs';
    }
  } catch (_error) {
    // Ignore malformed package.json entries and fall back to defaults.
  }

  return undefined;
};

const findNearestPackageJson = (cwd: string, fileExists: typeof fs.existsSync): string | null => {
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fileExists(candidate)) {
      return candidate;
    }

    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return null;
};

const resolveFormat = (format: ConfigFormat, packageType: PackageType): 'mjs' | 'js' | 'cjs' => {
  if (format === 'auto') {
    return packageType === 'module' ? 'js' : 'mjs';
  }

  return format;
};

const buildTemplate = (format: 'mjs' | 'js' | 'cjs'): string => {
  if (format === 'cjs') {
    return [
      "const { defineConfig } = require('@doccov/cli/config');",
      '',
      'module.exports = defineConfig({',
      '  include: [],',
      '  exclude: [],',
      '});',
      '',
    ].join('\n');
  }

  return [
    "import { defineConfig } from '@doccov/cli/config';",
    '',
    'export default defineConfig({',
    '  include: [],',
    '  exclude: [],',
    '});',
    '',
  ].join('\n');
};
