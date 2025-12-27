import { defineConfig } from 'bunup';

export default defineConfig([
  {
    entry: ['src/components/api/index.ts'],
    outDir: 'dist/api',
    dts: true,
    clean: true,
    format: ['esm'],
    target: 'browser',
    external: ['react', 'react-dom', 'clsx', 'tailwind-merge', 'class-variance-authority'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entry: ['src/components/docskit/index.ts'],
    outDir: 'dist/docskit',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: ['react', 'react-dom'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entry: ['src/lib/utils.ts'],
    outDir: 'dist/lib',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: ['clsx', 'tailwind-merge'],
  },
]);
