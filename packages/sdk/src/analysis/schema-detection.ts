/**
 * Runtime Schema Detection (Stubbed)
 *
 * Standard Schema extraction has been removed. This module provides
 * empty stubs to maintain API compatibility.
 */

export interface SchemaDetectionContext {
  baseDir: string;
  entryFile: string;
}

export interface SchemaDetectionResult {
  schemas: Map<string, never>;
  errors: string[];
}

export async function detectRuntimeSchemas(
  _context: SchemaDetectionContext,
): Promise<SchemaDetectionResult> {
  return {
    schemas: new Map(),
    errors: [],
  };
}

export function clearSchemaCache(): void {
  // no-op
}
