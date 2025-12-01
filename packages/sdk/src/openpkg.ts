import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as TS from 'typescript';
import type { AnalysisMetadataInternal } from './analysis/run-analysis';
import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgSpec } from './analysis/spec-types';
import { extractPackageSpec } from './extractor';
import { applyFilters } from './filtering/apply-filters';
import type { FilterOptions } from './filtering/types';
import type { DocCovOptions, NormalizedDocCovOptions } from './options';
import { normalizeDocCovOptions } from './options';
import { ts } from './ts-module';

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}

export interface AnalysisResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
  metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
}

export interface AnalyzeOptions {
  filters?: FilterOptions;
}

export class DocCov {
  private readonly options: NormalizedDocCovOptions;

  constructor(options: DocCovOptions = {}) {
    this.options = normalizeDocCovOptions(options);
  }

  async analyze(
    code: string,
    fileName = 'temp.ts',
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<OpenPkgSpec> {
    const resolvedFileName = path.resolve(fileName);
    const tempDir = path.dirname(resolvedFileName);
    const spec = await extractPackageSpec(resolvedFileName, tempDir, code, this.options);
    return this.applySpecFilters(spec, analyzeOptions.filters).spec;
  }

  async analyzeFile(filePath: string, analyzeOptions: AnalyzeOptions = {}): Promise<OpenPkgSpec> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const packageDir = resolvePackageDir(resolvedPath);
    const spec = await extractPackageSpec(resolvedPath, packageDir, content, this.options);
    return this.applySpecFilters(spec, analyzeOptions.filters).spec;
  }

  async analyzeProject(
    entryPath: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<OpenPkgSpec> {
    return this.analyzeFile(entryPath, analyzeOptions);
  }

  async analyzeWithDiagnostics(
    code: string,
    fileName?: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const resolvedFileName = path.resolve(fileName ?? 'temp.ts');
    const packageDir = resolvePackageDir(resolvedFileName);
    const analysis = runAnalysis({
      entryFile: resolvedFileName,
      packageDir,
      content: code,
      options: this.options,
    });

    const filterOutcome = this.applySpecFilters(analysis.spec, analyzeOptions.filters);

    return {
      spec: filterOutcome.spec,
      diagnostics: [
        ...analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
        ...analysis.specDiagnostics,
        ...filterOutcome.diagnostics,
      ],
      metadata: this.normalizeMetadata(analysis.metadata),
    };
  }

  async analyzeFileWithDiagnostics(
    filePath: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const packageDir = resolvePackageDir(resolvedPath);
    const analysis = runAnalysis({
      entryFile: resolvedPath,
      packageDir,
      content,
      options: this.options,
    });

    const filterOutcome = this.applySpecFilters(analysis.spec, analyzeOptions.filters);

    return {
      spec: filterOutcome.spec,
      diagnostics: [
        ...analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
        ...analysis.specDiagnostics,
        ...filterOutcome.diagnostics,
      ],
      metadata: this.normalizeMetadata(analysis.metadata),
    };
  }

  private normalizeDiagnostic(tsDiagnostic: TS.Diagnostic): Diagnostic {
    const message = ts.flattenDiagnosticMessageText(tsDiagnostic.messageText, '\n');

    let location: Diagnostic['location'];
    if (tsDiagnostic.file && typeof tsDiagnostic.start === 'number') {
      const { line, character } = tsDiagnostic.file.getLineAndCharacterOfPosition(
        tsDiagnostic.start,
      );
      location = {
        file: tsDiagnostic.file.fileName,
        line: line + 1,
        column: character + 1,
      };
    }

    const severity = this.mapSeverity(tsDiagnostic.category);

    return {
      message,
      severity,
      location,
    };
  }

  private mapSeverity(category: TS.DiagnosticCategory): Diagnostic['severity'] {
    switch (category) {
      case ts.DiagnosticCategory.Message:
      case ts.DiagnosticCategory.Suggestion:
        return 'info';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      default:
        return 'error';
    }
  }

  private normalizeMetadata(metadata: AnalysisMetadataInternal): AnalysisMetadata {
    return {
      baseDir: metadata.baseDir,
      configPath: metadata.configPath,
      packageJsonPath: metadata.packageJsonPath,
      hasNodeModules: metadata.hasNodeModules,
      resolveExternalTypes: metadata.resolveExternalTypes,
    };
  }

  private applySpecFilters(
    spec: OpenPkgSpec,
    filters?: FilterOptions,
  ): { spec: OpenPkgSpec; diagnostics: Diagnostic[] } {
    if (!filters || (!filters.include?.length && !filters.exclude?.length)) {
      return { spec, diagnostics: [] };
    }

    const result = applyFilters(spec, filters);
    return {
      spec: result.spec,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        message: diagnostic.message,
        severity: diagnostic.severity,
      })),
    };
  }
}

export async function analyze(code: string, options: AnalyzeOptions = {}): Promise<OpenPkgSpec> {
  return new DocCov().analyze(code, 'temp.ts', options);
}

export async function analyzeFile(
  filePath: string,
  options: AnalyzeOptions = {},
): Promise<OpenPkgSpec> {
  return new DocCov().analyzeFile(filePath, options);
}

/** @deprecated Use DocCov instead */
export const OpenPkg: typeof DocCov = DocCov;

function resolvePackageDir(entryFile: string): string {
  const fallbackDir = path.dirname(entryFile);
  let currentDir = fallbackDir;

  while (true) {
    const candidate = path.join(currentDir, 'package.json');
    if (fsSync.existsSync(candidate)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return fallbackDir;
    }

    currentDir = parentDir;
  }
}
