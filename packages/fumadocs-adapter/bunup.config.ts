import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/components/index.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['react', 'react-dom', '@openpkg-ts/doc-generator'],
});
