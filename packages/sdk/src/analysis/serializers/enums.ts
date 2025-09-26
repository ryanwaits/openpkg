import type * as ts from 'typescript';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
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
  id: string;
  name: string;
  value?: string;
  description: string;
}> {
  return enumDecl.members.map((member) => ({
    id: member.name?.getText() || '',
    name: member.name?.getText() || '',
    value: member.initializer ? member.initializer.getText() : undefined,
    description: '',
  }));
}
