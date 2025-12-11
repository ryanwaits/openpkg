// Cache utilities

// Drift categorization utilities
export {
  buildExportRegistry,
  type CategorizedDrift,
  calculateAggregateCoverage,
  categorizeDrift,
  computeDrift,
  computeExportDrift,
  type DriftResult,
  type DriftSummary,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  type ExportDriftResult,
  ensureSpecCoverage,
  formatDriftSummaryLine,
  getDriftSummary,
  groupDriftsByCategory,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
// Enrichment and coverage analysis
export {
  type EnrichedDocsMetadata,
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
export {
  CACHE_VERSION,
  type CacheContext,
  type CacheValidationResult,
  clearSpecCache,
  diffHashes,
  getSpecCachePath,
  hashFile,
  hashFiles,
  hashString,
  loadSpecCache,
  SPEC_CACHE_FILE,
  type SpecCache,
  type SpecCacheConfig,
  saveSpecCache,
  validateSpecCache,
} from './cache';
// Configuration types
export type {
  CheckConfig,
  DocCovConfig,
  DocsConfig,
  ExampleValidationMode,
  QualityRulesConfig,
  QualitySeverity,
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
// Unified example validation
export {
  ALL_VALIDATIONS,
  type ExampleValidation,
  type ExampleValidationOptions,
  type ExampleValidationResult,
  type ExampleValidationTypeError,
  type LLMAssertion,
  type PresenceResult,
  parseExamplesFlag,
  type RuntimeDrift,
  type RunValidationResult,
  shouldValidate,
  type TypecheckValidationResult,
  VALIDATION_INFO,
  validateExamples,
} from './examples';
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
// Quality rules engine
export {
  type AggregateQualityResult,
  BUILTIN_RULES,
  CORE_RULES,
  evaluateExportQuality,
  evaluateQuality,
  getCoverageRules,
  getDefaultConfig,
  getRule,
  getRulesForKind,
  mergeConfig,
  type QualityConfig,
  type QualityResult,
  type QualityRule,
  type QualityViolation,
  type RuleContext,
  STYLE_RULES,
} from './quality';
// Project resolution
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';
// Scan types and utilities
export type {
  // Build plan types
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
  // GitHub context types
  BuildHints,
  DetectedPackageManager,
  GitHubProjectContext,
  GitHubRepoMetadata,
  WorkspaceConfig,
  // Summary
  SpecSummary,
  SummaryDriftIssue,
} from './scan';
export {
  extractSpecSummary,
  fetchGitHubContext,
  listWorkspacePackages,
  parseGitHubUrl as parseScanGitHubUrl,
} from './scan';
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
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_PATH,
  type DocCovReport,
  type DriftReport,
  type DriftReportSummary,
  type ExportCoverageData,
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './types/report';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
