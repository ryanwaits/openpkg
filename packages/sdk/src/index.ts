export {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
export type { OpenPkgSpec } from './analysis/spec-types';
// Enrichment and coverage analysis
export {
  enrichSpec,
  type EnrichedExport,
  type EnrichedOpenPkg,
  type EnrichOptions,
} from './analysis/enrich';
// Report generation
export {
  generateReport,
  generateReportFromEnriched,
  loadCachedReport,
  saveReport,
  isCachedReportValid,
} from './analysis/report';
// Report types
export {
  type DocCovReport,
  type CoverageSummary,
  type ExportCoverageData,
  REPORT_VERSION,
  DEFAULT_REPORT_PATH,
} from './types/report';
// Project detection (for CLI and API)
export {
  type AnalyzeProjectOptions,
  // High-level API
  analyzeProject,
  type BuildInfo,
  detectBuildInfo,
  detectEntryPoint,
  detectMonorepo,
  // Detection functions
  detectPackageManager,
  type EntryPointInfo,
  type EntryPointSource,
  // Types
  type FileSystem,
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  getPrimaryBuildScript,
  getRunCommand,
  type MonorepoInfo,
  type MonorepoType,
  // FileSystem implementations
  NodeFileSystem,
  type PackageExports,
  type PackageJson,
  type PackageManager,
  type PackageManagerInfo,
  type ProjectInfo,
  readPackageJson,
  SandboxFileSystem,
  // Utilities
  safeParseJson,
  type WorkspacePackage,
} from './detect';
export { extractPackageSpec } from './extractor';
export type { FilterOptions } from './filtering/types';
export type { FilterSource, ResolvedFilters } from './filtering/merge';
export { mergeFilters, parseListFlag } from './filtering/merge';
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
// Lint engine
export {
  allRules,
  consistentParamStyle,
  getDefaultConfig,
  getRule,
  type LintConfig,
  type LintResult,
  type LintRule,
  type LintSeverity,
  type LintViolation,
  lintExport,
  lintExports,
  mergeConfig,
  noEmptyReturns,
  requireDescription,
  requireExample,
} from './lint';
// Markdown/MDX analysis
export type {
  DiffWithDocsOptions,
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MarkdownCodeBlock,
  MarkdownDocFile,
  MemberChange,
  SpecDiffWithDocs,
} from './markdown';
export {
  analyzeDocsImpact,
  blockReferencesExport,
  diffSpecWithDocs,
  extractFunctionCalls,
  extractImports,
  findDeprecatedReferences,
  findExportReferences,
  findRemovedReferences,
  getDocsImpactSummary,
  getDocumentedExports,
  getUndocumentedExports,
  hasDocsForExport,
  hasDocsImpact,
  isExecutableLang,
  parseMarkdownFile,
  parseMarkdownFiles,
} from './markdown';
export type { AnalysisResult, AnalyzeOptions, Diagnostic } from './openpkg';
export { analyze, analyzeFile, DocCov, OpenPkg } from './openpkg';
export type { DocCovOptions, OpenPkgOptions } from './options';
// Example typechecker
export {
  type ExampleTypeError,
  type TypecheckOptions,
  type TypecheckResult,
  typecheckExample,
  typecheckExamples,
} from './typecheck';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
// Scan types and utilities
export type {
  DriftIssue,
  ProgressCallback,
  ProgressEvent,
  ProgressStage,
  ScanContext,
  ScanOptions,
  ScanOrchestratorOptions,
  ScanResult,
  SpecSummary,
} from './scan';
export { extractSpecSummary, MonorepoRequiresPackageError, ScanOrchestrator } from './scan';
// GitHub utilities
export type { ParsedGitHubUrl } from './github';
export {
  buildCloneUrl,
  buildDisplayUrl,
  buildRawUrl,
  fetchSpec,
  fetchSpecFromGitHub,
  parseGitHubUrl,
} from './github';
// Project resolution
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';
// Dependency installation
export type { CommandResult, CommandRunner, InstallOptions, InstallResult } from './install';
export { createNodeCommandRunner, installDependencies } from './install';
// Configuration types
export type {
  CheckConfig,
  DocCovConfig,
  DocsConfig,
  LintRulesConfig,
} from './config';
export { defineConfig } from './config';
