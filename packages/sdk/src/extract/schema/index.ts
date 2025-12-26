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

export { arktypeAdapter } from './adapters/arktype';
export { typeboxAdapter } from './adapters/typebox';
export { valibotAdapter } from './adapters/valibot';
// Individual adapters (for extension/testing)
export { zodAdapter } from './adapters/zod';
// Registry (main API - static extraction)
export {
  extractSchemaOutputType,
  extractSchemaType,
  findAdapter,
  getRegisteredAdapters,
  getSupportedLibraries,
  isSchemaType,
} from './registry';
// Standard Schema (runtime extraction)
export {
  type ExtractStandardSchemasOptions,
  extractStandardSchemas,
  extractStandardSchemasFromProject,
  isStandardJSONSchema,
  resolveCompiledPath,
  type StandardJSONSchemaV1,
  type StandardSchemaExtractionOutput,
  type StandardSchemaExtractionResult,
} from './standard-schema';
// Types
export type { SchemaAdapter, SchemaExtractionResult } from './types';
export { getNonNullableType, isTypeReference } from './types';
