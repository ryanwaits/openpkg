export {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
// Enrichment and coverage analysis
export {
  type EnrichedExport,
  type EnrichedOpenPkg,
  type EnrichOptions,
  enrichSpec,
} from './analysis/enrich';
// Report generation
export {
  generateReport,
  generateReportFromEnriched,
  isCachedReportValid,
  loadCachedReport,
  saveReport,
} from './analysis/report';
export type { OpenPkgSpec } from './analysis/spec-types';
// Configuration types
export type {
  CheckConfig,
  DocCovConfig,
  DocsConfig,
  LintRulesConfig,
} from './config';
export { defineConfig } from './config';
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
export type { FilterSource, ResolvedFilters } from './filtering/merge';
export { mergeFilters, parseListFlag } from './filtering/merge';
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
// Dependency installation
export type { CommandResult, CommandRunner, InstallOptions, InstallResult } from './install';
export { createNodeCommandRunner, installDependencies } from './install';
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
// Project resolution
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';
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
// Example typechecker
export {
  type ExampleTypeError,
  type TypecheckOptions,
  type TypecheckResult,
  typecheckExample,
  typecheckExamples,
} from './typecheck';
// Report types
export {
  type CoverageSummary,
  DEFAULT_REPORT_PATH,
  type DocCovReport,
  type ExportCoverageData,
  REPORT_VERSION,
} from './types/report';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
