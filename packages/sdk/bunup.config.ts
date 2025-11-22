import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  splitting: true,
  format: ['esm'],
  external: ['@openpkg-ts/spec', 'typescript'],
});
