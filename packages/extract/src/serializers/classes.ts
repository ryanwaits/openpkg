import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import type { SerializerContext } from './context';

export function serializeClass(
  node: ts.ClassDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  // TODO: Extract class members
  return {
    id: name,
    name,
    kind: 'class',
    description,
    tags,
    source,
    members: [],
  };
}
