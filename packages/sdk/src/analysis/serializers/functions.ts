import * as ts from 'typescript';
import { TypeRegistry } from '../type-registry';
import type { ExportDefinition, TypeReference } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import { formatTypeReference, structureParameter } from '../../utils/parameter-utils';
import { getParameterDocumentation, parseJSDocComment } from '../../utils/tsdoc-utils';
import { collectReferencedTypes } from '../../utils/type-utils';

export interface SerializerContext {
  checker: ts.TypeChecker;
  typeRegistry: TypeRegistry;
}

export function serializeFunctionExport(
  declaration: ts.FunctionDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): ExportDefinition {
  const { checker, typeRegistry } = context;
  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();

  return {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'function',
    signatures: getFunctionSignatures(declaration, checker, typeRefs, referencedTypes),
    description: getJSDocComment(symbol, checker),
    source: getSourceLocation(declaration),
  };
}

function getFunctionSignatures(
  func: ts.FunctionDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): Array<{
  parameters: ReturnType<typeof structureParameter>[];
  returns: { schema: TypeReference; description: string };
}> {
  const signature = typeChecker.getSignatureFromDeclaration(func);
  if (!signature) return [];

  const funcSymbol = typeChecker.getSymbolAtLocation(func.name || func);
  const functionDoc = funcSymbol ? parseJSDocComment(funcSymbol, typeChecker) : null;

  return [
    {
      parameters: signature.getParameters().map((param) => {
        const paramDecl = param.valueDeclaration as ts.ParameterDeclaration;
        const paramType = typeChecker.getTypeAtLocation(paramDecl);

        collectReferencedTypes(paramType, typeChecker, referencedTypes);

        const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);

        return structureParameter(
          param,
          paramDecl,
          paramType,
          typeChecker,
          typeRefs,
          functionDoc,
          paramDoc,
          referencedTypes,
        );
      }),
      returns: {
        schema: signature.getReturnType()
          ? formatTypeReference(signature.getReturnType(), typeChecker, typeRefs, referencedTypes)
          : { type: 'void' },
        description: functionDoc?.returns || '',
      },
    },
  ];
}
