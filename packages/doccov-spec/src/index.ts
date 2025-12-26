// Types
export type {
  DriftType,
  DriftCategory,
  DocCovDrift,
  ExampleTypecheckError,
  ExampleRuntimeDrift,
  ExampleAnalysis,
  MissingDocRule,
  DocCovSpecVersion,
  DocCovSpec,
  DocCovSummary,
  ExportAnalysis,
} from './types';

// Constants
export {
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_LABELS,
  DRIFT_CATEGORY_DESCRIPTIONS,
} from './types';

export { SCHEMA_VERSION, SCHEMA_URL } from './constants';

// Validation
export type { DocCovSchemaVersion, DocCovSpecError } from './validate';
export {
  LATEST_VERSION,
  validateDocCovSpec,
  assertDocCovSpec,
  getDocCovValidationErrors,
  getAvailableDocCovVersions,
} from './validate';
