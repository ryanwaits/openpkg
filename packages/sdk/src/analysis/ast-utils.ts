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
