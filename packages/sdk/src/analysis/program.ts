import * as path from 'node:path';
import * as ts from 'typescript';

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.CommonJS,
  lib: ['lib.es2021.d.ts'],
  allowJs: true,
  declaration: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
};

export interface ProgramBuilderInput {
  entryFile: string;
  baseDir?: string;
  content?: string;
}

export interface ProgramBuildResult {
  program: ts.Program;
  compilerHost: ts.CompilerHost;
  compilerOptions: ts.CompilerOptions;
  sourceFile?: ts.SourceFile;
  configPath?: string;
}

export function createProgram({
  entryFile,
  baseDir = path.dirname(entryFile),
  content,
}: ProgramBuilderInput): ProgramBuildResult {
  const configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'tsconfig.json');
  let compilerOptions: ts.CompilerOptions = { ...DEFAULT_COMPILER_OPTIONS };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = { ...compilerOptions, ...parsedConfig.options };
  }

  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  let inMemorySource: ts.SourceFile | undefined;

  if (content !== undefined) {
    inMemorySource = ts.createSourceFile(
      entryFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

    compilerHost.getSourceFile = (
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) => {
      if (fileName === entryFile) {
        return inMemorySource;
      }

      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
  }

  const program = ts.createProgram([entryFile], compilerOptions, compilerHost);
  const sourceFile = inMemorySource ?? program.getSourceFile(entryFile);

  return {
    program,
    compilerHost,
    compilerOptions,
    sourceFile,
    configPath,
  };
}
