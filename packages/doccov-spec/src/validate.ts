import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import schemaV100 from '../schemas/v1.0.0/doccov.schema.json';
import type { DocCovSpec } from './types';

export type DocCovSchemaVersion = '1.0.0' | 'latest';

export const LATEST_VERSION: DocCovSchemaVersion = '1.0.0';

export type DocCovSpecError = {
  instancePath: string;
  message: string;
  keyword: string;
};

const schemas: Record<string, unknown> = {
  '1.0.0': schemaV100,
};

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const validatorCache = new Map<string, ValidateFunction<DocCovSpec>>();

function getValidator(version: DocCovSchemaVersion = 'latest'): ValidateFunction<DocCovSpec> {
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

  // biome-ignore lint/suspicious/noExplicitAny: Ajv schema type is dynamically loaded
  validator = ajv.compile<DocCovSpec>(schema as any);
  validatorCache.set(resolvedVersion, validator);
  return validator;
}

export function validateDocCovSpec(
  spec: unknown,
  version: DocCovSchemaVersion = 'latest',
): { ok: true } | { ok: false; errors: DocCovSpecError[] } {
  const validate = getValidator(version);
  const ok = validate(spec);

  if (ok) {
    return { ok: true };
  }

  const errors = (validate.errors ?? []).map<DocCovSpecError>((error) => ({
    instancePath: error.instancePath ?? '',
    message: error.message ?? 'invalid',
    keyword: error.keyword ?? 'unknown',
  }));

  return {
    ok: false,
    errors,
  };
}

export function assertDocCovSpec(
  spec: unknown,
  version: DocCovSchemaVersion = 'latest',
): asserts spec is DocCovSpec {
  const result = validateDocCovSpec(spec, version);
  if (!result.ok) {
    const details = result.errors
      .map((error) => `- ${error.instancePath || '/'} ${error.message}`)
      .join('\n');
    throw new Error(`Invalid DocCovSpec:\n${details}`);
  }
}

export function getDocCovValidationErrors(
  spec: unknown,
  version: DocCovSchemaVersion = 'latest',
): DocCovSpecError[] {
  const result = validateDocCovSpec(spec, version);
  return result.ok ? [] : result.errors;
}

export function getAvailableDocCovVersions(): string[] {
  return Object.keys(schemas);
}
