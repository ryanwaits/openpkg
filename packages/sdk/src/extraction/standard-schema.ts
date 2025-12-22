/**
 * Standard JSON Schema Integration
 *
 * Provides runtime detection and extraction of Standard JSON Schema v1 compliant libraries.
 * This enables support for Zod v4.2+, ArkType, Valibot, and other Standard Schema compliant libraries.
 *
 * @see https://github.com/standard-schema/standard-schema
 */

/**
 * Standard JSON Schema V1 interface (minimal subset for detection).
 * Full spec: https://github.com/standard-schema/standard-schema
 */
export interface StandardJSONSchemaV1 {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly jsonSchema: {
      readonly output: (options?: StandardSchemaOutputOptions) => Record<string, unknown>;
    };
  };
}

/**
 * Options for Standard Schema JSON output.
 */
export interface StandardSchemaOutputOptions {
  /**
   * Target JSON Schema dialect.
   * - 'draft-07': JSON Schema Draft 07 (widest compatibility)
   * - 'draft-2020-12': Latest JSON Schema (best features)
   * - 'openapi-3.0': OpenAPI 3.0 compatible schema
   */
  target?: 'draft-07' | 'draft-2020-12' | 'openapi-3.0';
}

/**
 * Result of Standard Schema extraction.
 */
export interface StandardSchemaResult {
  /** The extracted JSON Schema */
  schema: Record<string, unknown>;
  /** The vendor library (e.g., 'zod', 'arktype', 'valibot') */
  vendor: string;
  /** Standard Schema version */
  version: number;
}

/**
 * Check if a value implements the Standard JSON Schema v1 interface.
 *
 * This enables runtime detection of schema libraries that implement the standard,
 * including Zod v4.2+, ArkType, Valibot, and others.
 *
 * @param value - Value to check
 * @returns True if the value implements StandardJSONSchemaV1
 *
 * @example
 * ```typescript
 * import { isStandardJSONSchema, extractViaStandardSchema } from '@doccov/sdk';
 * import { z } from 'zod';
 *
 * const UserSchema = z.object({
 *   name: z.string(),
 *   age: z.number().min(0),
 * });
 *
 * if (isStandardJSONSchema(UserSchema)) {
 *   const jsonSchema = extractViaStandardSchema(UserSchema);
 *   console.log(jsonSchema);
 *   // { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number', minimum: 0 } } }
 * }
 * ```
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  const standard = obj['~standard'];

  if (typeof standard !== 'object' || standard === null) {
    return false;
  }

  const stdObj = standard as Record<string, unknown>;

  // Check for version (must be number, v1 = 1)
  if (typeof stdObj.version !== 'number') {
    return false;
  }

  // Check for jsonSchema.output function
  const jsonSchema = stdObj.jsonSchema;
  if (typeof jsonSchema !== 'object' || jsonSchema === null) {
    return false;
  }

  const jsonSchemaObj = jsonSchema as Record<string, unknown>;
  return typeof jsonSchemaObj.output === 'function';
}

/**
 * Extract JSON Schema from a Standard Schema v1 compliant value.
 *
 * @param schema - A value implementing StandardJSONSchemaV1
 * @param options - Extraction options
 * @returns Extracted JSON Schema result with vendor info
 * @throws Error if the value doesn't implement Standard Schema
 *
 * @example
 * ```typescript
 * import { extractViaStandardSchema } from '@doccov/sdk';
 *
 * // Works with any Standard Schema v1 compliant library
 * const result = extractViaStandardSchema(mySchema, { target: 'draft-2020-12' });
 * console.log(result.vendor); // 'zod', 'arktype', 'valibot', etc.
 * console.log(result.schema); // The extracted JSON Schema
 * ```
 */
export function extractViaStandardSchema(
  schema: StandardJSONSchemaV1,
  options: StandardSchemaOutputOptions = {},
): StandardSchemaResult {
  const standard = schema['~standard'];
  const target = options.target ?? 'draft-2020-12';

  const extractedSchema = standard.jsonSchema.output({ target });

  return {
    schema: extractedSchema,
    vendor: standard.vendor,
    version: standard.version,
  };
}

/**
 * Try to extract JSON Schema from a value that may or may not implement Standard Schema.
 *
 * @param value - Any value that might be a Standard Schema
 * @param options - Extraction options
 * @returns Extraction result, or null if value doesn't implement Standard Schema
 *
 * @example
 * ```typescript
 * import { tryExtractStandardSchema } from '@doccov/sdk';
 *
 * const result = tryExtractStandardSchema(unknownSchema);
 * if (result) {
 *   console.log(`Extracted ${result.vendor} schema:`, result.schema);
 * }
 * ```
 */
export function tryExtractStandardSchema(
  value: unknown,
  options: StandardSchemaOutputOptions = {},
): StandardSchemaResult | null {
  if (!isStandardJSONSchema(value)) {
    return null;
  }

  try {
    return extractViaStandardSchema(value, options);
  } catch {
    return null;
  }
}

/**
 * Supported Standard Schema vendors and their minimum versions.
 */
export const KNOWN_VENDORS = {
  zod: { minVersion: '4.2.0', homepage: 'https://zod.dev' },
  arktype: { minVersion: '2.0.0', homepage: 'https://arktype.io' },
  valibot: { minVersion: '1.0.0', homepage: 'https://valibot.dev' },
} as const;

export type KnownVendor = keyof typeof KNOWN_VENDORS;

