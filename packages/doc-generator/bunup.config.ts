import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts', 'src/react-styled.ts', 'src/cli.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['react', 'react-dom', 'tailwindcss'],
});
