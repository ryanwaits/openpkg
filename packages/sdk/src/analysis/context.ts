import * as path from 'node:path';
import type * as ts from 'typescript';
import type { NormalizedOpenPkgOptions, OpenPkgOptions } from '../options';
import { normalizeOpenPkgOptions } from '../options';
import { createProgram } from './program';

export interface AnalysisContext {
  entryFile: string;
  baseDir: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  compilerOptions: ts.CompilerOptions;
  compilerHost: ts.CompilerHost;
  options: NormalizedOpenPkgOptions;
  configPath?: string;
}

export interface AnalysisContextInput {
  entryFile: string;
  packageDir?: string;
  content?: string;
  options?: OpenPkgOptions;
}

export function createAnalysisContext({
  entryFile,
  packageDir,
  content,
  options,
}: AnalysisContextInput): AnalysisContext {
  const baseDir = packageDir ?? path.dirname(entryFile);
  const normalizedOptions: NormalizedOpenPkgOptions = normalizeOpenPkgOptions(options);

  const programResult = createProgram({ entryFile, baseDir, content });

  if (!programResult.sourceFile) {
    throw new Error(`Could not load ${entryFile}`);
  }

  return {
    entryFile,
    baseDir,
    program: programResult.program,
    checker: programResult.program.getTypeChecker(),
    sourceFile: programResult.sourceFile,
    compilerOptions: programResult.compilerOptions,
    compilerHost: programResult.compilerHost,
    options: normalizedOptions,
    configPath: programResult.configPath,
  };
}
