import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/tspec.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['typescript', 'commander', '@openpkg-ts/spec'],
});
