import ts from 'typescript';
import type { SpecExport, SpecSignature } from '@openpkg-ts/spec';
import type { SerializerContext } from './context';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import { extractParameters } from '../types/parameters';

export function serializeFunctionExport(
  node: ts.FunctionDeclaration | ts.ArrowFunction,
  ctx: SerializerContext,
): SpecExport | null {
  // Get name from symbol (works across files) or fall back to node name
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  const type = ctx.typeChecker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures: SpecSignature[] = callSignatures.map((sig) => {
    const params = extractParameters(sig, ctx.typeChecker);
    const returnType = ctx.typeChecker.getReturnTypeOfSignature(sig);

    return {
      parameters: params,
      returns: {
        schema: { type: ctx.typeChecker.typeToString(returnType) },
      },
    };
  });

  return {
    id: name,
    name,
    kind: 'function',
    description,
    tags,
    source,
    signatures,
  };
}
