import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['ajv', 'ajv-formats', 'ajv/dist/2020.js'],
});
