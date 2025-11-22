import type * as TS from 'typescript';
import { formatTypeReference } from '../../utils/parameter-utils';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { ExportDefinition, TypeReference } from '../spec-types';
import { type SerializerContext, serializeCallSignatures } from './functions';
import { extractPresentationMetadata } from './presentation';

export function serializeVariable(
  declaration: TS.VariableDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): ExportDefinition {
  const { checker, typeRegistry } = context;
  const variableType = checker.getTypeAtLocation(declaration.name ?? declaration);
  const callSignatures = variableType.getCallSignatures();
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);
  const metadata = extractPresentationMetadata(parsedDoc);

  if (callSignatures.length > 0) {
    return {
      id: symbol.getName(),
      name: symbol.getName(),
      ...metadata,
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
    ...metadata,
    kind: 'variable',
    type: typeToRef(declaration, checker, typeRefs, referencedTypes),
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
  };
}

function typeToRef(
  node: TS.Node,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): TypeReference {
  const type = typeChecker.getTypeAtLocation(node);
  collectReferencedTypes(type, typeChecker, referencedTypes);
  return formatTypeReference(type, typeChecker, typeRefs, referencedTypes);
}
