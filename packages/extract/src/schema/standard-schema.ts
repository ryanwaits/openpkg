import type { SpecSchema } from '@openpkg-ts/spec';
import type ts from 'typescript';

export interface StandardSchemaResult {
  schema: SpecSchema;
  vendor: string;
}

export function extractStandardSchemas(
  _program: ts.Program,
  _entryFile: string,
): StandardSchemaResult[] {
  // TODO: Implement runtime Standard Schema extraction
  return [];
}
