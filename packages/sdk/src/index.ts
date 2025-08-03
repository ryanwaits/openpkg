import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { extractPackageSpec } from './extractor';
import type { OpenPkgSpec } from './types/openpkg';

export interface OpenPkgOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
}

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}

export interface AnalysisResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
}

export class OpenPkg {
  private options: OpenPkgOptions;

  constructor(options: OpenPkgOptions = {}) {
    this.options = {
      includePrivate: false,
      followImports: true,
      ...options,
    };
  }

  /**
   * Analyze TypeScript code from a string
   */
  async analyze(code: string, fileName = 'temp.ts'): Promise<OpenPkgSpec> {
    // Create a temporary file-like structure for the extractor
    const tempDir = path.dirname(fileName);
    const result = await extractPackageSpec(fileName, tempDir, code, this.options);
    return result;
  }

  /**
   * Analyze a single file from disk
   */
  async analyzeFile(filePath: string): Promise<OpenPkgSpec> {
    const content = await fs.readFile(filePath, 'utf-8');
    const dir = path.dirname(filePath);
    const result = await extractPackageSpec(filePath, dir, content, this.options);
    return result;
  }

  /**
   * Analyze a project directory
   */
  async analyzeProject(entryPath: string): Promise<OpenPkgSpec> {
    // For now, just analyze the entry file
    // TODO: Implement full project analysis
    return this.analyzeFile(entryPath);
  }

  /**
   * Get analysis with diagnostics
   */
  async analyzeWithDiagnostics(code: string, fileName?: string): Promise<AnalysisResult> {
    const spec = await this.analyze(code, fileName);
    return {
      spec,
      diagnostics: [], // TODO: Collect actual diagnostics
    };
  }
}

// Convenience functions for one-off usage
export async function analyze(code: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyze(code);
}

export async function analyzeFile(filePath: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyzeFile(filePath);
}

export { extractPackageSpec } from './extractor';
// Re-export types
export * from './types/openpkg';
