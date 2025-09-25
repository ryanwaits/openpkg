import * as ts from 'typescript';
import type { ExportDefinition, TypeReference } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import { serializeCallSignatures, type SerializerContext } from './functions';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { formatTypeReference } from '../../utils/parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';

export function serializeVariable(
  declaration: ts.VariableDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): ExportDefinition {
  const { checker, typeRegistry } = context;
  const variableType = checker.getTypeAtLocation(declaration.name ?? declaration);
  const callSignatures = variableType.getCallSignatures();
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);

  if (callSignatures.length > 0) {
    return {
      id: symbol.getName(),
      name: symbol.getName(),
      kind: 'function',
      signatures: serializeCallSignatures(callSignatures, symbol, context, parsedDoc),
      description,
      source: getSourceLocation(declaration.initializer ?? declaration),
      examples: parsedDoc?.examples,
      tags: parsedDoc?.tags,
    };
  }

  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();

  return {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'variable',
    type: typeToRef(declaration, checker, typeRefs, referencedTypes),
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
  };
}

function typeToRef(
  node: ts.Node,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): TypeReference {
  const type = typeChecker.getTypeAtLocation(node);
  collectReferencedTypes(type, typeChecker, referencedTypes);
  return formatTypeReference(type, typeChecker, typeRefs, referencedTypes);
}
