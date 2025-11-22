import type * as TS from 'typescript';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import type { SerializerContext } from './functions';
import { extractPresentationMetadata } from './presentation';

export interface EnumSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeEnum(
  declaration: TS.EnumDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): EnumSerializationResult {
  const parsedDoc = parseJSDocComment(symbol, context.checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, context.checker);
  const metadata = extractPresentationMetadata(parsedDoc);

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'enum',
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
  };

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
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

function getEnumMembers(enumDecl: TS.EnumDeclaration): Array<{
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
