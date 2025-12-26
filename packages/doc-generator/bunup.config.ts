import { defineConfig } from 'bunup';

export default defineConfig([
  // Server build (Node.js) - includes fs, createDocs with file path support
  {
    name: 'server',
    entry: ['src/index.ts', 'src/cli.ts'],
    outDir: 'dist',
    dts: true,
    clean: true,
    format: ['esm'],
    target: 'node',
    external: ['react', 'react-dom', 'tailwindcss'],
  },
  // Client build (Browser) - React components only, no Node.js polyfills
  {
    name: 'client',
    entry: ['src/react.ts', 'src/react-styled.ts'],
    outDir: 'dist',
    dts: true,
    format: ['esm'],
    target: 'browser',
    splitting: false, // Prevent shared chunks with server build
    external: ['react', 'react-dom', 'tailwindcss'],
  },
]);
