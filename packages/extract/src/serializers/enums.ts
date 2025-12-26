import type { SpecExport, SpecMember } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import type { SerializerContext } from './context';

export function serializeEnum(node: ts.EnumDeclaration, ctx: SerializerContext): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  const members: SpecMember[] = node.members.map((member) => {
    const memberSymbol = ctx.typeChecker.getSymbolAtLocation(member.name);
    const memberName = memberSymbol?.getName() ?? member.name.getText();
    return {
      id: memberName,
      name: memberName,
      kind: 'enum-member',
    };
  });

  return {
    id: name,
    name,
    kind: 'enum',
    description,
    tags,
    source,
    members,
  };
}
