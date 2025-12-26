import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Import all schema versions
import schemaV010 from '../schemas/v0.1.0/openpkg.schema.json';
import schemaV020 from '../schemas/v0.2.0/openpkg.schema.json';
import schemaV030 from '../schemas/v0.3.0/openpkg.schema.json';
import schemaV040 from '../schemas/v0.4.0/openpkg.schema.json';

import type { OpenPkg } from './types';

/** Supported schema versions */
export type SchemaVersion = '0.1.0' | '0.2.0' | '0.3.0' | '0.4.0' | 'latest';

/** Current/latest schema version */
export const LATEST_VERSION: SchemaVersion = '0.4.0';

export type SpecError = {
  instancePath: string;
  message: string;
  keyword: string;
};

// Schema registry
const schemas: Record<string, unknown> = {
  '0.1.0': schemaV010,
  '0.2.0': schemaV020,
  '0.3.0': schemaV030,
  '0.4.0': schemaV040,
};

// Ajv instance (shared)
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  allowUnionTypes: true,
  $data: true,
});
addFormats(ajv);

// Validator cache by version
const validatorCache = new Map<string, ValidateFunction<OpenPkg>>();

/**
 * Get a compiled validator for a specific schema version.
 * Validators are cached for reuse.
 *
 * @param version - Schema version ('0.1.0', '0.2.0', '0.3.0', or 'latest')
 * @returns Compiled Ajv validator
 */
function getValidator(version: SchemaVersion = 'latest'): ValidateFunction<OpenPkg> {
  const resolvedVersion = version === 'latest' ? LATEST_VERSION : version;

  let validator = validatorCache.get(resolvedVersion);
  if (validator) {
    return validator;
  }

  const schema = schemas[resolvedVersion];
  if (!schema) {
    throw new Error(
      `Unknown schema version: ${resolvedVersion}. Available: ${Object.keys(schemas).join(', ')}`,
    );
  }

  // Cast to any to avoid strict Ajv type checking on dynamic schemas
  // biome-ignore lint/suspicious/noExplicitAny: Ajv schema type is dynamically loaded
  validator = ajv.compile<OpenPkg>(schema as any);
  validatorCache.set(resolvedVersion, validator);
  return validator;
}

/**
 * Validate a spec against a specific schema version.
 *
 * @param spec - The spec object to validate
 * @param version - Schema version to validate against (default: 'latest')
 * @returns Validation result
 */
export function validateSpec(
  spec: unknown,
  version: SchemaVersion = 'latest',
): { ok: true } | { ok: false; errors: SpecError[] } {
  const validate = getValidator(version);
  const ok = validate(spec);

  if (ok) {
    return { ok: true };
  }

  const errors = (validate.errors ?? []).map<SpecError>((error) => ({
    instancePath: error.instancePath ?? '',
    message: error.message ?? 'invalid',
    keyword: error.keyword ?? 'unknown',
  }));

  return {
    ok: false,
    errors,
  };
}

/**
 * Get available schema versions.
 */
export function getAvailableVersions(): string[] {
  return Object.keys(schemas);
}

/**
 * Assert that a value is a valid OpenPkg spec.
 * Throws an error with details if validation fails.
 *
 * @param spec - The value to validate
 * @param version - Schema version to validate against (default: 'latest')
 */
export function assertSpec(
  spec: unknown,
  version: SchemaVersion = 'latest',
): asserts spec is OpenPkg {
  const result = validateSpec(spec, version);
  if (!result.ok) {
    const details = result.errors
      .map((error) => `- ${error.instancePath || '/'} ${error.message}`)
      .join('\n');
    throw new Error(`Invalid OpenPkg spec:\n${details}`);
  }
}

/**
 * Get validation errors for a spec.
 *
 * @param spec - The spec to validate
 * @param version - Schema version to validate against (default: 'latest')
 * @returns Array of validation errors (empty if valid)
 */
export function getValidationErrors(spec: unknown, version: SchemaVersion = 'latest'): SpecError[] {
  const result = validateSpec(spec, version);
  return result.ok ? [] : result.errors;
}
