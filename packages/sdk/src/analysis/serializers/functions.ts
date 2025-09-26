import * as ts from 'typescript';
import { formatTypeReference, structureParameter } from '../../utils/parameter-utils';
import {
  getParameterDocumentation,
  type ParsedJSDoc,
  parseJSDocComment,
} from '../../utils/tsdoc-utils';
import { collectReferencedTypes, collectReferencedTypesFromNode } from '../../utils/type-utils';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { ExportDefinition, TypeReference } from '../spec-types';
import type { TypeRegistry } from '../type-registry';

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
      const paramDecl = param.declarations?.find(ts.isParameter) as
        | ts.ParameterDeclaration
        | undefined;
      const paramType = paramDecl
        ? paramDecl.type != null
          ? checker.getTypeFromTypeNode(paramDecl.type)
          : checker.getTypeAtLocation(paramDecl)
        : checker.getTypeOfSymbolAtLocation(
            param,
            symbol?.declarations?.[0] ??
              signature.declaration ??
              param.declarations?.[0] ??
              param.valueDeclaration!,
          );

      collectReferencedTypes(paramType, checker, referencedTypes);
      if (paramDecl?.type) {
        // The declared node can contain additional named intersections/unions
        // that the checker type flattens away; walk it to discover every alias
        // so we can surface them in the spec.
        collectReferencedTypesFromNode(paramDecl.type, checker, referencedTypes);
      }

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
  const { checker } = context;
  const signature = checker.getSignatureFromDeclaration(declaration);
  const funcSymbol = checker.getSymbolAtLocation(declaration.name || declaration);
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);

  return {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'function',
    signatures: signature
      ? serializeCallSignatures([signature], funcSymbol ?? symbol, context, parsedDoc)
      : [],
    description,
    source: getSourceLocation(declaration),
    examples: parsedDoc?.examples,
    tags: parsedDoc?.tags,
  };
}
