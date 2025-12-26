/**
 * CLI command registration functions for @openpkg-ts/doc-generator
 *
 * These functions can be used programmatically to add doc-generator
 * commands to your own CLI.
 *
 * @example
 * ```ts
 * import { Command } from 'commander';
 * import { registerBuildCommand, registerGenerateCommand, registerDevCommand } from '@openpkg-ts/doc-generator/cli';
 *
 * const program = new Command();
 * registerBuildCommand(program);
 * registerGenerateCommand(program);
 * registerDevCommand(program);
 * program.parse();
 * ```
 */

export { type BuildOptions, registerBuildCommand } from './build';
export { type DevOptions, registerDevCommand } from './dev';
export {
  type GenerateFormat,
  type GenerateOptions,
  type GroupBy,
  type NavFormat,
  registerGenerateCommand,
} from './generate';
