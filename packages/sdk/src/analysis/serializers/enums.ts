import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';

export interface EnumSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeEnum(
  declaration: ts.EnumDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): EnumSerializationResult {
  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'enum',
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'enum',
    members: getEnumMembers(declaration),
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  return {
    exportEntry,
    typeDefinition,
  };
}

function getEnumMembers(enumDecl: ts.EnumDeclaration): Array<{
  name: string;
  value?: string;
  description: string;
}> {
  return enumDecl.members.map((member) => ({
    name: member.name?.getText() || '',
    value: member.initializer ? member.initializer.getText() : undefined,
    description: '',
  }));
}
