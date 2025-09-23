import * as ts from 'typescript';
import { TypeRegistry } from '../type-registry';
import type { ExportDefinition, TypeReference } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import { formatTypeReference, structureParameter } from '../../utils/parameter-utils';
import { getParameterDocumentation, parseJSDocComment, type ParsedJSDoc } from '../../utils/tsdoc-utils';
import { collectReferencedTypes } from '../../utils/type-utils';

export interface SerializerContext {
  checker: ts.TypeChecker;
  typeRegistry: TypeRegistry;
}

export function serializeCallSignatures(
  signatures: readonly ts.Signature[],
  symbol: ts.Symbol | undefined,
  context: SerializerContext,
  parsedDoc?: ParsedJSDoc | null,
): Array<{
  parameters: ReturnType<typeof structureParameter>[];
  returns: { schema: TypeReference; description: string };
  description?: string;
}> {
  if (signatures.length === 0) {
    return [];
  }

  const { checker, typeRegistry } = context;
  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();
  const functionDoc = parsedDoc ?? (symbol ? parseJSDocComment(symbol, checker) : null);

  return signatures.map((signature) => {
    const parameters = signature.getParameters().map((param) => {
      const paramDecl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
      const paramType = paramDecl
        ? paramDecl.type != null
          ? checker.getTypeFromTypeNode(paramDecl.type)
          : checker.getTypeAtLocation(paramDecl)
        : checker.getTypeOfSymbolAtLocation(
            param,
            symbol?.declarations?.[0] ?? signature.declaration ?? param.declarations?.[0] ?? param.valueDeclaration!,
          );

      collectReferencedTypes(paramType, checker, referencedTypes);

      if (paramDecl && ts.isParameter(paramDecl)) {
        const paramDoc = getParameterDocumentation(param, paramDecl, checker);

        return structureParameter(
          param,
          paramDecl,
          paramType,
          checker,
          typeRefs,
          functionDoc,
          paramDoc,
          referencedTypes,
        );
      }

      return {
        name: param.getName(),
        required: !(param.flags & ts.SymbolFlags.Optional),
        description: '',
        schema: formatTypeReference(paramType, checker, typeRefs, referencedTypes),
      };
    });

    const returnType = signature.getReturnType();
    if (returnType) {
      collectReferencedTypes(returnType, checker, referencedTypes);
    }

    return {
      parameters,
      returns: {
        schema: returnType
          ? formatTypeReference(returnType, checker, typeRefs, referencedTypes)
          : { type: 'void' },
        description: functionDoc?.returns || '',
      },
      description: functionDoc?.description || undefined,
    };
  });
}

export function serializeFunctionExport(
  declaration: ts.FunctionDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): ExportDefinition {
  const { checker, typeRegistry } = context;
  const signature = checker.getSignatureFromDeclaration(declaration);
  const funcSymbol = checker.getSymbolAtLocation(declaration.name || declaration);
  const parsedDoc = parseJSDocComment(symbol, checker);

  return {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'function',
    signatures: signature
      ? serializeCallSignatures([signature], funcSymbol ?? symbol, context, parsedDoc)
      : [],
    description: getJSDocComment(symbol, checker),
    source: getSourceLocation(declaration),
    examples: parsedDoc?.examples,
  };
}
