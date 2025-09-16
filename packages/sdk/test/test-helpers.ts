import * as ts from 'typescript';

export interface TestCompilerContext {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
}

export function createTestCompiler(code: string, fileName = 'test.ts'): TestCompilerContext {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
  };

  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  const host = ts.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile?.bind(host);

  host.getSourceFile = (
    requestedFileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (requestedFileName === fileName) {
      return sourceFile;
    }

    return originalGetSourceFile(
      requestedFileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  host.readFile = (requestedFileName) => {
    if (requestedFileName === fileName) {
      return code;
    }

    return originalReadFile ? originalReadFile(requestedFileName) : ts.sys.readFile(requestedFileName);
  };

  host.fileExists = (requestedFileName) => {
    if (requestedFileName === fileName) {
      return true;
    }

    return ts.sys.fileExists(requestedFileName);
  };

  host.writeFile = () => {
    // Skip poking the filesystem during tests
  };

  const program = ts.createProgram([fileName], compilerOptions, host);
  const checker = program.getTypeChecker();

  return { program, checker, sourceFile };
}

export function getDeclaration<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T {
  for (const statement of sourceFile.statements) {
    if (predicate(statement)) {
      return statement;
    }
  }

  throw new Error('Declaration not found in test source');
}
