import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/config/index.ts'],
  dts: true,
  clean: true,
  splitting: true,
  format: ['esm'],
  external: ['@openpkg-ts/sdk', '@openpkg-ts/spec', 'commander', 'chalk', 'ora', '@inquirer/prompts'],
});
