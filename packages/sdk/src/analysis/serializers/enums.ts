import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';
import { parseJSDocComment } from '../../utils/tsdoc-utils';

export interface EnumSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeEnum(
  declaration: ts.EnumDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): EnumSerializationResult {
  const parsedDoc = parseJSDocComment(symbol, context.checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, context.checker);

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'enum',
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
  };

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'enum',
    members: getEnumMembers(declaration),
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
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
