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
  MemberChangeType,
} from './types';

// Parser functions
export type { MethodCall } from './parser';
export {
  blockReferencesExport,
  extractFunctionCalls,
  extractImports,
  extractMethodCalls,
  findExportReferences,
  hasInstantiation,
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

// Member diff functions
export type { MemberChange } from './member-diff';
export {
  diffMemberChanges,
  getMemberChangesForClass,
  hasAddedMembers,
  hasRemovedMembers,
} from './member-diff';

// Diff with docs impact
export type { DiffWithDocsOptions, SpecDiffWithDocs } from './diff-with-docs';
export {
  diffSpecWithDocs,
  getDocsImpactSummary,
  hasDocsImpact,
} from './diff-with-docs';

