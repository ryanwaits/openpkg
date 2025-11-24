import type * as TS from 'typescript';
import { ts } from '../ts-module';

export function getJSDocComment(symbol: TS.Symbol, typeChecker: TS.TypeChecker): string {
  const comments = symbol.getDocumentationComment(typeChecker);
  return ts.displayPartsToString(comments);
}

export function getSourceLocation(node: TS.Node): { file: string; line: number } {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}

export function isSymbolDeprecated(symbol: TS.Symbol | undefined): boolean {
  if (!symbol) {
    return false;
  }

  const jsDocTags = symbol.getJsDocTags();
  if (jsDocTags.some((tag) => tag.name.toLowerCase() === 'deprecated')) {
    return true;
  }

  for (const declaration of symbol.getDeclarations() ?? []) {
    if (ts.getJSDocDeprecatedTag(declaration)) {
      return true;
    }
  }

  return false;
}
