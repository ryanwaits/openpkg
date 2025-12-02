/**
 * Markdown/MDX documentation analysis module
 */

// Types
export type {
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MarkdownCodeBlock,
  MarkdownDocFile,
} from './types';

// Parser functions
export {
  blockReferencesExport,
  extractFunctionCalls,
  extractImports,
  findExportReferences,
  isExecutableLang,
  parseMarkdownFile,
  parseMarkdownFiles,
} from './parser';

// Analyzer functions
export {
  analyzeDocsImpact,
  findDeprecatedReferences,
  findRemovedReferences,
  getDocumentedExports,
  getUndocumentedExports,
  hasDocsForExport,
} from './analyzer';

// Diff with docs impact
export type { DiffWithDocsOptions, SpecDiffWithDocs } from './diff-with-docs';
export {
  diffSpecWithDocs,
  getDocsImpactSummary,
  hasDocsImpact,
} from './diff-with-docs';

