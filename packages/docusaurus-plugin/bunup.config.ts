import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['@docusaurus/core', '@openpkg-ts/spec', 'react'],
});
