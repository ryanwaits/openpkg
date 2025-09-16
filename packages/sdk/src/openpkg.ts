import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { extractPackageSpec } from './extractor';
import type { OpenPkgSpec } from './types/openpkg';
import type { NormalizedOpenPkgOptions, OpenPkgOptions } from './options';
import { normalizeOpenPkgOptions } from './options';

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
  private readonly options: NormalizedOpenPkgOptions;

  constructor(options: OpenPkgOptions = {}) {
    this.options = normalizeOpenPkgOptions(options);
  }

  async analyze(code: string, fileName = 'temp.ts'): Promise<OpenPkgSpec> {
    const tempDir = path.dirname(fileName);
    return extractPackageSpec(fileName, tempDir, code, this.options);
  }

  async analyzeFile(filePath: string): Promise<OpenPkgSpec> {
    const content = await fs.readFile(filePath, 'utf-8');
    const dir = path.dirname(filePath);
    return extractPackageSpec(filePath, dir, content, this.options);
  }

  async analyzeProject(entryPath: string): Promise<OpenPkgSpec> {
    return this.analyzeFile(entryPath);
  }

  async analyzeWithDiagnostics(code: string, fileName?: string): Promise<AnalysisResult> {
    const spec = await this.analyze(code, fileName);
    return {
      spec,
      diagnostics: [],
    };
  }
}

export async function analyze(code: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyze(code);
}

export async function analyzeFile(filePath: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyzeFile(filePath);
}
