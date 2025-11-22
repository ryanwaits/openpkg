// Types for CLI operations

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

export interface Import {
  path: string;
  type: 'relative' | 'package' | 'absolute';
  isTypeOnly?: boolean;
  defaultImport?: string;
  namespaceImport?: string;
  importedNames?: string[];
}

export interface DependencyGraph {
  totalFiles: number;
  analyzedFiles: number;
  errorFiles: number;
  totalImports: number;
  maxDepth: number;
  actualMaxDepth?: number;
}

export interface AnalyzeMetadata {
  filesAnalyzed: number;
  duration: number;
  cached: boolean;
  dependencyGraph?: DependencyGraph;
}

export interface Export {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
  kind: string;
}

export interface Type {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
  kind: string;
}

export interface OpenPkgSpec {
  openpkg: string;
  exports?: Export[];
  types?: Type[];
}

export interface AnalyzeResponse {
  spec?: OpenPkgSpec;
  imports?: Import[];
  parseErrors?: ParseError[];
  metadata: AnalyzeMetadata;
  files?: Record<string, unknown>;
  content?: string;
  error?: {
    code: string;
    message: string;
  };
}
