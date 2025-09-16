import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';

export interface ClassSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeClass(
  declaration: ts.ClassDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): ClassSerializationResult {
  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'class',
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'class',
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  return {
    exportEntry,
    typeDefinition,
  };
}
