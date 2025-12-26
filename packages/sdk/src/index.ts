/**
 * DocCov SDK - Documentation coverage and drift detection for TypeScript.
 *
 * This is the main entry point with core functionality.
 * For specialized utilities, use subpath imports:
 *
 * @example
 * ```ts
 * // Core API (this module)
 * import { DocCov, enrichSpec, computeDrift } from '@doccov/sdk';
 *
 * // Analysis utilities
 * import { generateReport, computeSnapshot } from '@doccov/sdk/analysis';
 *
 * // Type definitions
 * import type { DocCovReport, FilterOptions } from '@doccov/sdk/types';
 * ```
 *
 * @module @doccov/sdk
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Analysis API
// ─────────────────────────────────────────────────────────────────────────────

export { DocCov, analyze, analyzeFile } from './openpkg';
export type { AnalysisResult, AnalyzeOptions, Diagnostic } from './openpkg';
export type { DocCovOptions } from './options';

// Enrichment (most commonly used)
export { enrichSpec } from './analysis/enrich';
export type { EnrichedExport, EnrichedOpenPkg, EnrichOptions } from './analysis/enrich';

// Drift detection (most commonly used)
export {
  computeDrift,
  computeExportDrift,
  buildExportRegistry,
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_LABELS,
  DRIFT_CATEGORY_DESCRIPTIONS,
} from './analysis/docs-coverage';
export type {
  DriftResult,
  CategorizedDrift,
  DriftSummary,
  DriftType,
  DriftCategory,
  SpecDocDrift,
} from './analysis/docs-coverage';

// DocCov spec builder
export { buildDocCovSpec } from './analysis/doccov-builder';
export type { BuildDocCovOptions } from './analysis/doccov-builder';

// Report generation
export { generateReport, renderApiSurface } from './analysis/report';

// Spec types
export type { OpenPkgSpec } from './analysis/spec-types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export { defineConfig } from './config';
export type { DocCovConfig, CheckConfig, DocsConfig } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Project Resolution & Detection
// ─────────────────────────────────────────────────────────────────────────────

export { resolveTarget } from './resolve';
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';

export { analyzeProject, detectPackageManager, NodeFileSystem } from './detect';
export type { FileSystem, PackageJson, ProjectInfo, PackageManager } from './detect';

// ─────────────────────────────────────────────────────────────────────────────
// Example Validation
// ─────────────────────────────────────────────────────────────────────────────

export { validateExamples, parseExamplesFlag } from './examples';
export type {
  ExampleValidation,
  ExampleValidationResult,
  ExampleValidationOptions,
} from './examples';

// ─────────────────────────────────────────────────────────────────────────────
// Fix Utilities
// ─────────────────────────────────────────────────────────────────────────────

export {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  findJSDocLocation,
  generateFixesForExport,
  isFixableDrift,
  mergeFixes,
  parseJSDocToPatch,
  serializeJSDoc,
} from './fix';
export type { JSDocEdit, JSDocPatch, FixSuggestion } from './fix';

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Analysis
// ─────────────────────────────────────────────────────────────────────────────

export { parseMarkdownFiles, findExportReferences } from './markdown';
export type { MarkdownDocFile, MarkdownCodeBlock } from './markdown';

// ─────────────────────────────────────────────────────────────────────────────
// Report Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { DocCovReport, ExportCoverageData, CoverageSummary } from './types/report';

// ─────────────────────────────────────────────────────────────────────────────
// Filter Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { FilterOptions, ReleaseTag } from './filtering/types';

// ─────────────────────────────────────────────────────────────────────────────
// Typecheck
// ─────────────────────────────────────────────────────────────────────────────

export { typecheckExamples } from './typecheck';
export type { ExampleTypeError, TypecheckResult } from './typecheck';

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports (for backward compatibility)
// Consider migrating to subpath imports: @doccov/sdk/analysis, @doccov/sdk/types
// ─────────────────────────────────────────────────────────────────────────────

// Analysis (migrate to @doccov/sdk/analysis)
export {
  categorizeDrift,
  groupDriftsByCategory,
  getDriftSummary,
  formatDriftSummaryLine,
  calculateAggregateCoverage,
  ensureSpecCoverage,
  detectExampleRuntimeErrors,
  detectExampleAssertionFailures,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
export type { ExportDriftResult } from './analysis/docs-coverage';
export type { EnrichedDocsMetadata } from './analysis/enrich';

export { generateReportFromEnriched, saveReport, loadCachedReport } from './analysis/report';

export {
  computeSnapshot,
  saveSnapshot,
  loadSnapshots,
  getTrend,
  getExtendedTrend,
  formatDelta,
  renderSparkline,
  pruneHistory,
  pruneByTier,
  HISTORY_DIR,
  RETENTION_DAYS,
} from './analysis/history';
export type {
  CoverageSnapshot,
  CoverageTrend,
  ExtendedTrendAnalysis,
  RetentionTier,
} from './analysis/history';

// Cache (for advanced usage)
export {
  loadSpecCache,
  saveSpecCache,
  clearSpecCache,
  validateSpecCache,
  hashFiles,
  hashFile,
  hashString,
  getSpecCachePath,
  diffHashes,
  CACHE_VERSION,
  SPEC_CACHE_FILE,
} from './cache';
export type { SpecCache, CacheContext, CacheValidationResult, SpecCacheConfig } from './cache';

// Detection (for advanced usage)
export {
  detectEntryPoint,
  detectBuildInfo,
  detectMonorepo,
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  getRunCommand,
  getPrimaryBuildScript,
  readPackageJson,
  safeParseJson,
  SandboxFileSystem,
} from './detect';
export type {
  AnalyzeProjectOptions,
  BuildInfo,
  EntryPointInfo,
  EntryPointSource,
  MonorepoInfo,
  MonorepoType,
  PackageExports,
  PackageManagerInfo,
  WorkspacePackage,
} from './detect';

// Schema extraction
export {
  extractSchemaType,
  extractSchemaOutputType,
  findAdapter,
  getRegisteredAdapters,
  getSupportedLibraries,
  isSchemaType,
  extractStandardSchemas,
  extractStandardSchemasFromProject,
  isStandardJSONSchema,
  resolveCompiledPath,
} from './extract/schema';
export type {
  SchemaAdapter,
  SchemaExtractionResult,
  ExtractStandardSchemasOptions,
  StandardJSONSchemaV1,
  StandardSchemaExtractionOutput,
  StandardSchemaExtractionResult,
} from './extract/schema';

export { extractPackageSpec } from './extractor';

// Schema detection
export { detectRuntimeSchemas } from './analysis/schema-detection';
export type { SchemaDetectionContext, SchemaDetectionResult } from './analysis/schema-detection';

// Examples (additional exports)
export { ALL_VALIDATIONS, VALIDATION_INFO, shouldValidate } from './examples';
export type {
  ExampleValidationTypeError,
  LLMAssertion,
  PresenceResult,
  RuntimeDrift,
  RunValidationResult,
  TypecheckValidationResult,
} from './examples';

// Fix (additional exports)
export { applyPatchToJSDoc, generateFix } from './fix';
export type { ApplyEditsResult, FixType, JSDocParam, JSDocReturn, JSDocTag } from './fix';

// GitHub
export {
  parseGitHubUrl,
  fetchSpec,
  fetchSpecFromGitHub,
  buildRawUrl,
  buildCloneUrl,
  buildDisplayUrl,
} from './github';
export type { ParsedGitHubUrl } from './github';

// Install
export { installDependencies, createNodeCommandRunner } from './install';
export type { InstallOptions, InstallResult, CommandRunner, CommandResult } from './install';

// Markdown (additional exports)
export {
  parseMarkdownFile,
  analyzeDocsImpact,
  diffSpecWithDocs,
  blockReferencesExport,
  extractFunctionCalls,
  extractImports,
  findDeprecatedReferences,
  findRemovedReferences,
  getDocsImpactSummary,
  getDocumentedExports,
  getUndocumentedExports,
  hasDocsForExport,
  hasDocsImpact,
  isExecutableLang,
} from './markdown';
export type {
  DiffWithDocsOptions,
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MemberChange,
  SpecDiffWithDocs,
} from './markdown';

// Filtering
export { mergeFilters, parseListFlag } from './filtering/merge';
export type { FilterSource, ResolvedFilters } from './filtering/merge';

// Scan
export { extractSpecSummary, fetchGitHubContext, listWorkspacePackages } from './scan';
export { parseGitHubUrl as parseScanGitHubUrl } from './scan';
export type {
  BuildHints,
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
  DetectedPackageManager,
  FetchGitHubContextOptions,
  GitHubProjectContext,
  GitHubRepoMetadata,
  SpecSummary,
  SummaryDriftIssue,
  WorkspaceConfig,
} from './scan';

// Typecheck (additional exports)
export { typecheckExample } from './typecheck';
export type { TypecheckOptions } from './typecheck';

// Report types (additional exports)
export {
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_PATH,
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './types/report';
export type { DriftReport, DriftReportSummary } from './types/report';

// Example runner
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';

// Config types (additional)
export type { ExampleValidationMode, SchemaExtractionMode } from './config';

// Context types
export type { DetectedSchemaEntry } from './analysis/context';
