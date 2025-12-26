import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import type { SerializerContext } from './context';

export function serializeTypeAlias(
  node: ts.TypeAliasDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);
  const type = ctx.typeChecker.getTypeAtLocation(node);
  const typeString = ctx.typeChecker.typeToString(type);

  return {
    id: name,
    name,
    kind: 'type',
    description,
    tags,
    source,
    // Only include type field if it's not just the name itself
    ...(typeString !== name ? { type: typeString } : {}),
  };
}
