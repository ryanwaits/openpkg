import { defineConfig } from 'bunup';

export default defineConfig({
  entry: [
    'src/components/api/index.ts',
    'src/components/docskit/index.ts',
    'src/lib/utils.ts',
  ],
  outDir: 'dist',
  dts: true,
  clean: true,
  format: ['esm'],
  target: 'browser',
  external: ['react', 'react-dom'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
