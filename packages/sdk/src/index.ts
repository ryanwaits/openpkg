export {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
export type { OpenPkgSpec } from './analysis/spec-types';
export { extractPackageSpec } from './extractor';
export type { FilterOptions } from './filtering/types';
// Fix utilities
export {
  type ApplyEditsResult,
  applyEdits,
  applyPatchToJSDoc,
  categorizeDrifts,
  createSourceFile,
  type FixSuggestion,
  type FixType,
  findJSDocLocation,
  generateFix,
  generateFixesForExport,
  isFixableDrift,
  type JSDocEdit,
  type JSDocParam,
  type JSDocPatch,
  type JSDocReturn,
  type JSDocTag,
  mergeFixes,
  parseJSDocToPatch,
  serializeJSDoc,
} from './fix';
export type { AnalysisResult, AnalyzeOptions, Diagnostic } from './openpkg';
export { analyze, analyzeFile, DocCov, OpenPkg } from './openpkg';
export type { DocCovOptions, OpenPkgOptions } from './options';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
