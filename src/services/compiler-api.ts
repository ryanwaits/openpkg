import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface CompilerAPIService {
  createProgram(files: string[], options?: ts.CompilerOptions): ts.Program;
  getTypeChecker(): ts.TypeChecker;
  getSourceFile(fileName: string): ts.SourceFile | undefined;
}

export class CompilerAPIServiceImpl implements CompilerAPIService {
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  createProgram(files: string[], options?: ts.CompilerOptions): ts.Program {
    // Validate input files
    const validatedFiles = this.validateFiles(files);
    
    // Default compiler options
    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      lib: ["lib.es2021.d.ts"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: true,
      checkJs: false,
      declaration: false,
      outDir: undefined,
      rootDir: undefined,
    };

    // Merge with provided options
    const compilerOptions = { ...defaultOptions, ...options };

    // Create the program
    this.program = ts.createProgram({
      rootNames: validatedFiles,
      options: compilerOptions,
      host: this.createCompilerHost(compilerOptions),
    });

    // Initialize type checker
    this.typeChecker = this.program.getTypeChecker();

    // Check for compilation errors
    this.checkCompilationErrors();

    return this.program;
  }

  getTypeChecker(): ts.TypeChecker {
    if (!this.typeChecker) {
      throw new Error('TypeChecker not initialized. Call createProgram() first.');
    }
    return this.typeChecker;
  }

  getSourceFile(fileName: string): ts.SourceFile | undefined {
    if (!this.program) {
      throw new Error('Program not initialized. Call createProgram() first.');
    }
    return this.program.getSourceFile(fileName);
  }

  private validateFiles(files: string[]): string[] {
    const validatedFiles: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const absolutePath = path.resolve(file);
      
      if (!fs.existsSync(absolutePath)) {
        errors.push(`File not found: ${absolutePath}`);
        continue;
      }

      if (!this.isTypeScriptFile(absolutePath)) {
        errors.push(`Not a TypeScript file: ${absolutePath}`);
        continue;
      }

      validatedFiles.push(absolutePath);
    }

    if (errors.length > 0) {
      throw new Error(`File validation failed:\n${errors.join('\n')}`);
    }

    if (validatedFiles.length === 0) {
      throw new Error('No valid TypeScript files provided');
    }

    return validatedFiles;
  }

  private isTypeScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.d.ts'].includes(ext);
  }

  private createCompilerHost(options: ts.CompilerOptions): ts.CompilerHost {
    const host = ts.createCompilerHost(options);

    // Override readFile to handle encoding issues
    const originalReadFile = host.readFile;
    host.readFile = (fileName: string) => {
      try {
        return originalReadFile.call(host, fileName);
      } catch (error) {
        console.error(`Error reading file ${fileName}:`, error);
        return undefined;
      }
    };

    // Override fileExists for better error messages
    const originalFileExists = host.fileExists;
    host.fileExists = (fileName: string) => {
      const exists = originalFileExists.call(host, fileName);
      if (!exists && !fileName.includes('node_modules')) {
        console.warn(`File not found: ${fileName}`);
      }
      return exists;
    };

    return host;
  }

  private checkCompilationErrors(): void {
    if (!this.program) return;

    const diagnostics = [
      ...this.program.getSemanticDiagnostics(),
      ...this.program.getSyntacticDiagnostics(),
    ];

    if (diagnostics.length > 0) {
      const errorMessages = diagnostics
        .filter(d => d.category === ts.DiagnosticCategory.Error)
        .map(d => {
          if (d.file) {
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start!);
            return `${d.file.fileName}:${line + 1}:${character + 1} - ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
          }
          return ts.flattenDiagnosticMessageText(d.messageText, '\n');
        });

      if (errorMessages.length > 0) {
        console.warn('TypeScript compilation errors detected:');
        errorMessages.forEach(msg => console.warn(`  ${msg}`));
      }
    }
  }
}

// Factory function for creating a compiler API service
export function createCompilerAPIService(): CompilerAPIService {
  return new CompilerAPIServiceImpl();
}

// Helper function to find and load tsconfig.json
export function loadTsConfig(searchPath: string): ts.CompilerOptions | null {
  const configPath = ts.findConfigFile(searchPath, ts.sys.fileExists, 'tsconfig.json');
  
  if (!configPath) {
    return null;
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    console.warn(`Error reading tsconfig.json: ${configFile.error.messageText}`);
    return null;
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  if (parsedConfig.errors.length > 0) {
    console.warn('Errors parsing tsconfig.json:');
    parsedConfig.errors.forEach(error => {
      console.warn(`  ${error.messageText}`);
    });
  }

  return parsedConfig.options;
}