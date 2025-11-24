import type * as TS from 'typescript';
import { ts } from '../../ts-module';
import { formatTypeReference, structureParameter } from '../../utils/parameter-utils';
import { getParameterDocumentation, parseJSDocComment } from '../../utils/tsdoc-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { serializeTypeParameterDeclarations } from '../../utils/type-parameter-utils';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast-utils';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import type { SerializerContext } from './functions';
import { extractPresentationMetadata } from './presentation';

export interface ClassSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeClass(
  declaration: TS.ClassDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): ClassSerializationResult {
  const { checker, typeRegistry } = context;
  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();

  const members = serializeClassMembers(declaration, checker, typeRefs, referencedTypes);
  const typeParameters = serializeTypeParameterDeclarations(
    declaration.typeParameters,
    checker,
    referencedTypes,
  );
  const parsedDoc = parseJSDocComment(symbol, context.checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, context.checker);
  const metadata = extractPresentationMetadata(parsedDoc);

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'class',
    deprecated: isSymbolDeprecated(symbol),
    description,
    source: getSourceLocation(declaration),
    members: members.length > 0 ? members : undefined,
    typeParameters,
    tags: parsedDoc?.tags,
  };

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'class',
    description,
    source: getSourceLocation(declaration),
    members: members.length > 0 ? members : undefined,
    tags: parsedDoc?.tags,
  };

  return {
    exportEntry,
    typeDefinition,
  };
}

function serializeClassMembers(
  declaration: TS.ClassDeclaration,
  checker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): Array<NonNullable<TypeDefinition['members']>[number]> {
  const members: Array<NonNullable<TypeDefinition['members']>[number]> = [];

  for (const member of declaration.members) {
    if (!member.name && !ts.isConstructorDeclaration(member)) {
      continue;
    }

    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      const memberName = member.name?.getText();
      if (!memberName) continue;

      const memberSymbol = member.name ? checker.getSymbolAtLocation(member.name) : undefined;
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;
      const memberType = memberSymbol
        ? checker.getTypeOfSymbolAtLocation(memberSymbol, member)
        : member.type
          ? checker.getTypeFromTypeNode(member.type)
          : checker.getTypeAtLocation(member);

      collectReferencedTypes(memberType, checker, referencedTypes);
      const schema = formatTypeReference(memberType, checker, typeRefs, referencedTypes);

      const flags: Record<string, boolean> = {};
      const isOptionalSymbol =
        memberSymbol != null && (memberSymbol.flags & ts.SymbolFlags.Optional) !== 0;
      if (member.questionToken || isOptionalSymbol) {
        flags.optional = true;
      }
      if (member.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ReadonlyKeyword)) {
        flags.readonly = true;
      }
      if (member.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword)) {
        flags.static = true;
      }

      members.push({
        id: memberName,
        name: memberName,
        kind: 'property',
        visibility: getMemberVisibility(member.modifiers),
        schema,
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
        flags: Object.keys(flags).length > 0 ? flags : undefined,
        tags: memberDoc?.tags,
      });
      continue;
    }

    if (ts.isMethodDeclaration(member)) {
      const memberName = member.name?.getText() ?? 'method';
      const memberSymbol = member.name ? checker.getSymbolAtLocation(member.name) : undefined;
      const methodDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;
      const signature = checker.getSignatureFromDeclaration(member);

      const signatures = signature
        ? [
            serializeSignature(
              signature,
              checker,
              typeRefs,
              referencedTypes,
              methodDoc,
              memberSymbol,
            ),
          ]
        : undefined;

      members.push({
        id: memberName,
        name: memberName,
        kind: 'method',
        visibility: getMemberVisibility(member.modifiers),
        signatures,
        description:
          methodDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
        flags: getMethodFlags(member),
        tags: methodDoc?.tags,
      });
      continue;
    }

    if (ts.isConstructorDeclaration(member)) {
      const ctorSymbol = checker.getSymbolAtLocation(member); // may be undefined
      const ctorDoc = ctorSymbol ? parseJSDocComment(ctorSymbol, checker) : null;
      const signature = checker.getSignatureFromDeclaration(member);

      const signatures = signature
        ? [serializeSignature(signature, checker, typeRefs, referencedTypes, ctorDoc, ctorSymbol)]
        : undefined;

      members.push({
        id: 'constructor',
        name: 'constructor',
        kind: 'constructor',
        visibility: getMemberVisibility(member.modifiers),
        signatures,
        description:
          ctorDoc?.description ??
          (ctorSymbol ? getJSDocComment(ctorSymbol, checker) : undefined),
        tags: ctorDoc?.tags,
      });
      continue;
    }

    if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const memberName = member.name?.getText();
      if (!memberName) continue;

      const memberSymbol = checker.getSymbolAtLocation(member.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;
      const accessorType = ts.isGetAccessorDeclaration(member)
        ? checker.getTypeAtLocation(member)
        : member.parameters.length > 0
          ? checker.getTypeAtLocation(member.parameters[0])
          : checker.getTypeAtLocation(member);

      collectReferencedTypes(accessorType, checker, referencedTypes);
      const schema = formatTypeReference(accessorType, checker, typeRefs, referencedTypes);

      members.push({
        id: memberName,
        name: memberName,
        kind: 'accessor',
        visibility: getMemberVisibility(member.modifiers),
        schema,
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
        tags: memberDoc?.tags,
      });
    }
  }

  return members;
}

function serializeSignature(
  signature: ts.Signature,
  checker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
  doc: ReturnType<typeof parseJSDocComment>,
  symbol?: ts.Symbol,
): {
  parameters?: ReturnType<typeof structureParameter>[];
  returns?: { schema: ReturnType<typeof formatTypeReference>; description?: string };
  description?: string;
  typeParameters?: ReturnType<typeof serializeTypeParameterDeclarations>;
} {
  const typeParameters = serializeTypeParameterDeclarations(
    signature.declaration?.typeParameters,
    checker,
    referencedTypes,
  );

  return {
    parameters: signature.getParameters().map((param) => {
      const paramDecl = param.valueDeclaration as ts.ParameterDeclaration;
      const paramType =
        paramDecl?.type != null
          ? checker.getTypeFromTypeNode(paramDecl.type)
          : checker.getTypeAtLocation(paramDecl);

      collectReferencedTypes(paramType, checker, referencedTypes);

      const paramDoc = paramDecl ? getParameterDocumentation(param, paramDecl, checker) : undefined;

      return structureParameter(
        param,
        paramDecl,
        paramType,
        checker,
        typeRefs,
        doc,
        paramDoc,
        referencedTypes,
      );
    }),
    returns: {
      schema: formatTypeReference(signature.getReturnType(), checker, typeRefs, referencedTypes),
      description: doc?.returns || '',
    },
    description: doc?.description || (symbol ? getJSDocComment(symbol, checker) : undefined),
    typeParameters,
  };
}

function getMemberVisibility(
  modifiers?: ts.NodeArray<ts.ModifierLike>,
): 'public' | 'private' | 'protected' | undefined {
  if (!modifiers) return undefined;
  if (modifiers.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword)) {
    return 'private';
  }
  if (modifiers.some((mod) => mod.kind === ts.SyntaxKind.ProtectedKeyword)) {
    return 'protected';
  }
  if (modifiers.some((mod) => mod.kind === ts.SyntaxKind.PublicKeyword)) {
    return 'public';
  }
  return undefined;
}

function getMethodFlags(member: ts.MethodDeclaration): Record<string, boolean> | undefined {
  const flags: Record<string, boolean> = {};
  if (member.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword)) {
    flags.static = true;
  }
  if (member.asteriskToken) {
    flags.generator = true;
  }
  if (member.questionToken) {
    flags.optional = true;
  }
  return Object.keys(flags).length > 0 ? flags : undefined;
}
