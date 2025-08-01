import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/cli.ts'],
  dts: true,
  clean: true,
  splitting: true,
  format: ['esm'],
  external: ['openpkg-sdk', 'commander', 'chalk', 'ora', '@inquirer/prompts']
});