import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schemas/v0.2.0/openpkg.schema.json';

import type { OpenPkg } from './types';

export type SpecError = {
  instancePath: string;
  message: string;
  keyword: string;
};

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  allowUnionTypes: true,
  $data: true,
});
addFormats(ajv);
const validate = ajv.compile<OpenPkg>(schema as unknown);
export function validateSpec(spec: unknown): { ok: true } | { ok: false; errors: SpecError[] } {
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

export function assertSpec(spec: unknown): asserts spec is OpenPkg {
  const result = validateSpec(spec);
  if (!result.ok) {
    const details = result.errors
      .map((error) => `- ${error.instancePath || '/'} ${error.message}`)
      .join('\n');
    throw new Error(`Invalid OpenPkg spec:\n${details}`);
  }
}

export function getValidationErrors(spec: unknown): SpecError[] {
  const result = validateSpec(spec);
  return result.ok ? [] : result.errors;
}
