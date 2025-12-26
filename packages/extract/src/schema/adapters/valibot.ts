import type { SchemaAdapter } from '../registry';

export const valibotAdapter: SchemaAdapter = {
  name: 'valibot',
  detect: () => false, // TODO: Implement
  extract: () => null, // TODO: Implement
};
