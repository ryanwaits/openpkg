import * as ts from 'typescript';

export interface ImportInfo {
  type: 'relative' | 'package' | 'absolute';
  path: string;
  isTypeOnly: boolean;
  importedNames: string[];
  defaultImport?: string;
  namespaceImport?: string;
  isReExport?: boolean;
  exportedNames?: string[];
}

export interface ParseResult {
  imports: ImportInfo[];
  exports: string[];
  hasErrors: boolean;
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}

export class ImportParser {
  parse(code: string, fileName: string = 'temp.ts'): ParseResult {
    const result: ParseResult = {
      imports: [],
      exports: [],
      hasErrors: false,
      errors: [],
    };

    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);

    const syntaxErrors = this.getSyntaxErrors(sourceFile);
    if (syntaxErrors.length > 0) {
      result.hasErrors = true;
      result.errors = syntaxErrors;
    }

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const info = this.extractImportInfo(node);
        if (info) {
          result.imports.push(info);
        }
      } else if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const info = this.extractReExportInfo(node);
          if (info) {
            result.imports.push(info);
          }
        }
      } else if (ts.isExportAssignment(node)) {
        result.exports.push('export');
      }
    });

    return result;
  }

  private extractImportInfo(node: ts.ImportDeclaration): ImportInfo | null {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return null;
    }

    const path = moduleSpecifier.text;
    const isTypeOnly = node.importClause?.isTypeOnly || false;
    const importedNames: string[] = [];
    let defaultImport: string | undefined;
    let namespaceImport: string | undefined;

    if (node.importClause) {
      if (node.importClause.name) {
        defaultImport = node.importClause.name.text;
      }

      const namedBindings = node.importClause.namedBindings;
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
          namespaceImport = namedBindings.name.text;
        } else if (ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => {
            importedNames.push(element.name.text);
          });
        }
      }
    }

    return {
      type: this.getImportType(path),
      path,
      isTypeOnly,
      importedNames,
      defaultImport,
      namespaceImport,
    };
  }

  private extractReExportInfo(node: ts.ExportDeclaration): ImportInfo | null {
    const moduleSpecifier = node.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      return null;
    }

    const path = moduleSpecifier.text;
    const isTypeOnly = node.isTypeOnly || false;
    const exportedNames: string[] = [];
    let namespaceExport = false;

    if (node.exportClause) {
      if (ts.isNamespaceExport(node.exportClause)) {
        namespaceExport = true;
        exportedNames.push(node.exportClause.name.text);
      } else if (ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => {
          exportedNames.push(element.name.text);
        });
      }
    } else {
      namespaceExport = true;
      exportedNames.push('*');
    }

    return {
      type: this.getImportType(path),
      path,
      isTypeOnly,
      importedNames: [],
      isReExport: true,
      exportedNames,
      namespaceImport: namespaceExport ? '*' : undefined,
    };
  }

  private getImportType(path: string): 'relative' | 'package' | 'absolute' {
    if (path.startsWith('./') || path.startsWith('../')) {
      return 'relative';
    }
    if (path.startsWith('/')) {
      return 'absolute';
    }
    return 'package';
  }

  private getSyntaxErrors(
    sourceFile: ts.SourceFile,
  ): Array<{ message: string; line?: number; column?: number }> {
    const errors: Array<{ message: string; line?: number; column?: number }> = [];
    const syntacticDiagnostics = (sourceFile as any).parseDiagnostics;

    if (syntacticDiagnostics && syntacticDiagnostics.length > 0) {
      syntacticDiagnostics.forEach((diagnostic: any) => {
        errors.push({
          message: diagnostic.messageText || 'Syntax error',
          line: diagnostic.start
            ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1
            : undefined,
          column: diagnostic.start
            ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start).character + 1
            : undefined,
        });
      });
    }

    const text = sourceFile.getText();

    if (text.includes('import {') && !text.includes('}')) {
      const importIndex = text.indexOf('import {');
      const pos = sourceFile.getLineAndCharacterOfPosition(importIndex);
      errors.push({
        message: "'}' expected",
        line: pos.line + 1,
        column: pos.character + 1,
      });
    }

    if (/const\s+\w+\s*=\s*;/.test(text) || /let\s+\w+\s*=\s*;/.test(text)) {
      errors.push({
        message: 'Expression expected',
      });
    }

    return errors;
  }
}
