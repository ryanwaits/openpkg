/**
 * Schema Type Extraction Module
 *
 * Provides schema extraction from validation libraries:
 * - Zod
 * - Valibot
 * - TypeBox
 * - ArkType
 *
 * Two extraction modes:
 * 1. Static (TypeScript Compiler API) - no runtime, always available
 * 2. Standard Schema (runtime) - richer output when available
 */

// Types
export type { SchemaAdapter, SchemaExtractionResult } from './types';
export { isTypeReference, getNonNullableType } from './types';

// Registry (main API - static extraction)
export {
  findAdapter,
  isSchemaType,
  extractSchemaOutputType,
  extractSchemaType,
  getRegisteredAdapters,
  getSupportedLibraries,
} from './registry';

// Standard Schema (runtime extraction)
export {
  extractStandardSchemas,
  extractStandardSchemasFromProject,
  isStandardJSONSchema,
  resolveCompiledPath,
  type ExtractStandardSchemasOptions,
  type StandardJSONSchemaV1,
  type StandardSchemaExtractionOutput,
  type StandardSchemaExtractionResult,
} from './standard-schema';

// Individual adapters (for extension/testing)
export { zodAdapter } from './adapters/zod';
export { valibotAdapter } from './adapters/valibot';
export { typeboxAdapter } from './adapters/typebox';
export { arktypeAdapter } from './adapters/arktype';
