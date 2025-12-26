import type { SchemaAdapter } from '../registry';

export const arktypeAdapter: SchemaAdapter = {
  name: 'arktype',
  detect: () => false, // TODO: Implement
  extract: () => null, // TODO: Implement
};
