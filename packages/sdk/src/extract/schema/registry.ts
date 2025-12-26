/**
 * Schema Adapter Registry
 *
 * Central registry for schema adapters. Provides functions to detect
 * and extract output types from schema validation libraries.
 */
import type * as TS from 'typescript';
import { arktypeAdapter } from './adapters/arktype';
import { typeboxAdapter } from './adapters/typebox';
import { valibotAdapter } from './adapters/valibot';
import { zodAdapter } from './adapters/zod';
import type { SchemaAdapter, SchemaExtractionResult } from './types';

/**
 * Registered adapters in order of check priority.
 * Order matters if patterns overlap (e.g., both check for 'Schema' in name).
 */
const adapters: readonly SchemaAdapter[] = [
  zodAdapter, // Check Zod first (most popular)
  arktypeAdapter, // ArkType has distinctive Type< pattern
  typeboxAdapter, // TypeBox has distinctive T pattern
  valibotAdapter, // Valibot checked last (Schema pattern is broad)
];

/**
 * Find an adapter that matches the given type.
 * Returns null if no adapter matches.
 */
export function findAdapter(type: TS.Type, checker: TS.TypeChecker): SchemaAdapter | null {
  for (const adapter of adapters) {
    if (adapter.matches(type, checker)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Check if a type is from a recognized schema library.
 */
export function isSchemaType(type: TS.Type, checker: TS.TypeChecker): boolean {
  return findAdapter(type, checker) !== null;
}

/**
 * Extract the output type from a schema type.
 * Returns null if:
 * - The type is not from a recognized schema library
 * - The adapter fails to extract the output type
 */
export function extractSchemaOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
  const adapter = findAdapter(type, checker);
  if (!adapter) {
    return null;
  }
  return adapter.extractOutputType(type, checker);
}

/**
 * Full extraction with adapter info.
 * Useful when you need to know which library was detected.
 */
export function extractSchemaType(
  type: TS.Type,
  checker: TS.TypeChecker,
): SchemaExtractionResult | null {
  const adapter = findAdapter(type, checker);
  if (!adapter) {
    return null;
  }

  const outputType = adapter.extractOutputType(type, checker);
  if (!outputType) {
    return null;
  }

  const result: SchemaExtractionResult = {
    adapter,
    outputType,
  };

  // Optionally extract input type if adapter supports it
  if (adapter.extractInputType) {
    const inputType = adapter.extractInputType(type, checker);
    if (inputType) {
      result.inputType = inputType;
    }
  }

  return result;
}

/**
 * Get all registered adapters.
 * Useful for logging/debugging.
 */
export function getRegisteredAdapters(): readonly SchemaAdapter[] {
  return adapters;
}

/**
 * Get supported library names.
 * Useful for documentation/help output.
 */
export function getSupportedLibraries(): readonly string[] {
  return adapters.flatMap((a) => a.packages);
}
