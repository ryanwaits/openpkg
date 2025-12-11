import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['functions/execute.ts', 'functions/execute-stream.ts', 'functions/plan.ts'],
  dts: false,
  clean: true,
  splitting: false,
  format: ['esm'],
  outDir: 'dist/functions',
  external: [
    '@vercel/node',
    '@vercel/sandbox',
    '@doccov/sdk',
    '@openpkg-ts/spec',
  ],
});
