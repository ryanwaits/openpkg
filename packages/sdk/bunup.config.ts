import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/analysis/index.ts', 'src/types/index.ts'],
  dts: true,
  clean: true,
  splitting: true,
  format: ['esm'],
  external: ['@openpkg-ts/spec', 'typescript'],
});
