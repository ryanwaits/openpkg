import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { AnalysisMetadataInternal } from './analysis/run-analysis';
import { runAnalysis } from './analysis/run-analysis';
import { extractPackageSpec } from './extractor';
import type { NormalizedOpenPkgOptions, OpenPkgOptions } from './options';
import { normalizeOpenPkgOptions } from './options';
import type { OpenPkgSpec } from './types/openpkg';

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
  metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
}

export class OpenPkg {
  private readonly options: NormalizedOpenPkgOptions;

  constructor(options: OpenPkgOptions = {}) {
    this.options = normalizeOpenPkgOptions(options);
  }

  async analyze(code: string, fileName = 'temp.ts'): Promise<OpenPkgSpec> {
    const resolvedFileName = path.resolve(fileName);
    const tempDir = path.dirname(resolvedFileName);
    return extractPackageSpec(resolvedFileName, tempDir, code, this.options);
  }

  async analyzeFile(filePath: string): Promise<OpenPkgSpec> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const packageDir = resolvePackageDir(resolvedPath);
    return extractPackageSpec(resolvedPath, packageDir, content, this.options);
  }

  async analyzeProject(entryPath: string): Promise<OpenPkgSpec> {
    return this.analyzeFile(entryPath);
  }

  async analyzeWithDiagnostics(code: string, fileName?: string): Promise<AnalysisResult> {
    const resolvedFileName = path.resolve(fileName ?? 'temp.ts');
    const packageDir = resolvePackageDir(resolvedFileName);
    const analysis = runAnalysis({
      entryFile: resolvedFileName,
      packageDir,
      content: code,
      options: this.options,
    });

    return {
      spec: analysis.spec,
      diagnostics: analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
      metadata: this.normalizeMetadata(analysis.metadata),
    };
  }

  async analyzeFileWithDiagnostics(filePath: string): Promise<AnalysisResult> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const packageDir = resolvePackageDir(resolvedPath);
    const analysis = runAnalysis({
      entryFile: resolvedPath,
      packageDir,
      content,
      options: this.options,
    });

    return {
      spec: analysis.spec,
      diagnostics: analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
      metadata: this.normalizeMetadata(analysis.metadata),
    };
  }

  private normalizeDiagnostic(tsDiagnostic: ts.Diagnostic): Diagnostic {
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

  private mapSeverity(category: ts.DiagnosticCategory): Diagnostic['severity'] {
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
}

export async function analyze(code: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyze(code);
}

export async function analyzeFile(filePath: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyzeFile(filePath);
}

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
