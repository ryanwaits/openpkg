export {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';

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
  getDocumentedExports,
  getDocsImpactSummary,
  getUndocumentedExports,
  hasDocsForExport,
  hasDocsImpact,
  isExecutableLang,
  parseMarkdownFile,
  parseMarkdownFiles,
} from './markdown';
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

// Project detection (for CLI and API)
export {
  // Types
  type FileSystem,
  type PackageManager,
  type PackageManagerInfo,
  type MonorepoType,
  type MonorepoInfo,
  type WorkspacePackage,
  type EntryPointSource,
  type EntryPointInfo,
  type BuildInfo,
  type ProjectInfo,
  type AnalyzeProjectOptions,
  type PackageJson,
  type PackageExports,
  // FileSystem implementations
  NodeFileSystem,
  SandboxFileSystem,
  // Detection functions
  detectPackageManager,
  getInstallCommand,
  getRunCommand,
  detectMonorepo,
  findPackageByName,
  formatPackageList,
  detectEntryPoint,
  detectBuildInfo,
  getPrimaryBuildScript,
  // Utilities
  safeParseJson,
  readPackageJson,
  // High-level API
  analyzeProject,
} from './detect';

// Lint engine
export {
  allRules,
  getDefaultConfig,
  getRule,
  lintExport,
  lintExports,
  mergeConfig,
  consistentParamStyle,
  noEmptyReturns,
  requireDescription,
  requireExample,
  type LintConfig,
  type LintResult,
  type LintRule,
  type LintSeverity,
  type LintViolation,
} from './lint';

// Example typechecker
export {
  typecheckExample,
  typecheckExamples,
  type ExampleTypeError,
  type TypecheckOptions,
  type TypecheckResult,
} from './typecheck';
