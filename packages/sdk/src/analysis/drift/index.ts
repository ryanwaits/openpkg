// Drift types and constants (doccov-specific, moved from @openpkg-ts/spec v0.4.0)
export {
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_LABELS,
  DRIFT_CATEGORY_DESCRIPTIONS,
  type DriftType,
  type SpecDocDrift,
  type DriftCategory,
  type SpecDocsMetadata,
} from './types';

// Categorization utilities
export {
  categorizeDrift,
  formatDriftSummaryLine,
  getDriftSummary,
  groupDriftsByCategory,
} from './categorize';

// Core computation
export { buildExportRegistry, computeDrift, computeExportDrift } from './compute';
// Coverage utilities
export { calculateAggregateCoverage, ensureSpecCoverage } from './coverage';
// Example drift detection
export {
  detectExampleAssertionFailures,
  detectExampleDrift,
  detectExampleRuntimeErrors,
  detectExampleSyntaxErrors,
  hasNonAssertionComments,
  parseAssertions,
} from './example-drift';

// Parameter drift detection
export { detectOptionalityDrift, detectParamDrift, detectParamTypeDrift } from './param-drift';
// Semantic drift detection
export {
  detectAsyncMismatch,
  detectBrokenLinks,
  detectDeprecatedDrift,
  detectVisibilityDrift,
} from './semantic-drift';
// Type drift detection
export {
  detectGenericConstraintDrift,
  detectPropertyTypeDrift,
  detectReturnTypeDrift,
} from './type-drift';
export type {
  CategorizedDrift,
  ClosestMatch,
  CodeVisibility,
  DocumentedTemplateTag,
  DocVisibility,
  DocVisibilitySignal,
  DriftResult,
  DriftSummary,
  ExportDriftResult,
  ExportInfo,
  ExportRegistry,
  ParsedParamTag,
  SpecMemberWithType,
  SpecMemberWithVisibility,
} from './types';

// Utility functions (for advanced usage)
export {
  buildGenericConstraintMismatchIssue,
  buildGenericConstraintSuggestion,
  buildParamTypeMismatchIssue,
  buildReturnTypeMismatchIssue,
  collectActualTypeParameterConstraints,
  extractParamFromTag,
  extractReturnTypeFromTag,
  extractTypeFromBraces,
  extractTypeFromSchema,
  findClosestMatch,
  levenshtein,
  normalizeParamName,
  normalizeType,
  parseTemplateTag,
  splitCamelCase,
  typesEquivalent,
  unwrapPromise,
} from './utils';
