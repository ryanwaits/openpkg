export { detectExampleRuntimeErrors } from './analysis/docs-coverage';
export type { OpenPkgSpec } from './analysis/spec-types';
export { extractPackageSpec } from './extractor';
export type { FilterOptions } from './filtering/types';
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
