import type { SchemaAdapter } from '../registry';

export const typeboxAdapter: SchemaAdapter = {
  name: 'typebox',
  detect: () => false, // TODO: Implement
  extract: () => null, // TODO: Implement
};
