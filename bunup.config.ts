import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  outDir: 'dist',
  format: ['esm'], // Array format for ESM only
  target: 'node',
  clean: true, // Clean dist folder before build

  // External dependencies that shouldn't be bundled
  external: ['commander', 'typescript', 'zod', 'fs', 'path', 'url'],
});
