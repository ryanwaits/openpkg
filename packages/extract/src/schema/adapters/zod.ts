import type { SchemaAdapter } from '../registry';

export const zodAdapter: SchemaAdapter = {
  name: 'zod',
  detect: () => false, // TODO: Implement
  extract: () => null, // TODO: Implement
};
