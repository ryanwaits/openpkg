import type * as TS from 'typescript';
import { ts } from '../../ts-module';
import { formatTypeReference, structureParameter } from '../../utils/parameter-utils';
import { getParameterDocumentation, parseJSDocComment } from '../../utils/tsdoc-utils';
import { serializeTypeParameterDeclarations } from '../../utils/type-parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast-utils';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import type { SerializerContext } from './functions';
import { extractPresentationMetadata } from './presentation';

export interface InterfaceSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeInterface(
  declaration: TS.InterfaceDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): InterfaceSerializationResult {
  const { checker, typeRegistry } = context;
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);
  const metadata = extractPresentationMetadata(parsedDoc);
  const referencedTypes = typeRegistry.getReferencedTypes();
  const typeRefs = typeRegistry.getTypeRefs();
  const typeParameters = serializeTypeParameterDeclarations(
    declaration.typeParameters,
    checker,
    referencedTypes,
  );

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'interface',
    deprecated: isSymbolDeprecated(symbol),
    description,
    source: getSourceLocation(declaration),
    typeParameters,
    tags: parsedDoc?.tags,
    examples: parsedDoc?.examples,
  };

  const schema = interfaceToSchema(declaration, checker, typeRefs, referencedTypes);

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'interface',
    schema,
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
  };

  return {
    exportEntry,
    typeDefinition,
  };
}

function interfaceToSchema(
  iface: TS.InterfaceDeclaration,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): Record<string, unknown> {
  const schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: unknown;
    items?: unknown;
    callSignatures?: Array<{
      parameters: unknown[];
      returns: { schema: unknown };
    }>;
    constructSignatures?: Array<{
      parameters: unknown[];
      returns: { schema: unknown };
    }>;
  } = {
    type: 'object',
    properties: {},
  };

  const required: string[] = [];
  const callSignatures: Array<{
    parameters: unknown[];
    returns: { schema: unknown };
  }> = [];
  const constructSignatures: Array<{
    parameters: unknown[];
    returns: { schema: unknown };
  }> = [];

  for (const member of iface.members) {
    // Handle index signatures: [key: string]: T or [index: number]: T
    if (ts.isIndexSignatureDeclaration(member)) {
      const indexParam = member.parameters[0];
      if (indexParam && member.type) {
        const indexType = typeChecker.getTypeAtLocation(indexParam);
        const valueType = typeChecker.getTypeAtLocation(member.type);
        collectReferencedTypes(valueType, typeChecker, referencedTypes);

        const valueSchema = formatTypeReference(valueType, typeChecker, typeRefs, referencedTypes);

        // Check if it's a string or number index
        const indexTypeString = typeChecker.typeToString(indexType);
        if (indexTypeString === 'string') {
          // String index signature -> additionalProperties
          schema.additionalProperties = valueSchema;
        } else if (indexTypeString === 'number') {
          // Number index signature -> items (array-like)
          schema.items = valueSchema;
        }
      }
    }
    // Handle property signatures
    else if (ts.isPropertySignature(member)) {
      const propName = member.name?.getText() || '';

      if (member.type) {
        const propType = typeChecker.getTypeAtLocation(member.type);
        collectReferencedTypes(propType, typeChecker, referencedTypes);
      }

      schema.properties[propName] = member.type
        ? formatTypeReference(
            typeChecker.getTypeAtLocation(member.type),
            typeChecker,
            typeRefs,
            referencedTypes,
          )
        : { type: 'any' };

      if (!member.questionToken) {
        required.push(propName);
      }
    }
    // Handle method signatures
    else if (ts.isMethodSignature(member)) {
      const methodName = member.name?.getText() || '';
      const signature = typeChecker.getSignatureFromDeclaration(member);

      if (signature) {
        const parameters = signature.getParameters().map((param) => {
          const paramDecl = param.declarations?.find(ts.isParameter) as
            | TS.ParameterDeclaration
            | undefined;
          const paramType = paramDecl
            ? typeChecker.getTypeAtLocation(paramDecl)
            : typeChecker.getTypeOfSymbolAtLocation(param, member);

          collectReferencedTypes(paramType, typeChecker, referencedTypes);

          if (paramDecl) {
            const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);
            return structureParameter(
              param,
              paramDecl,
              paramType,
              typeChecker,
              typeRefs,
              null,
              paramDoc,
              referencedTypes,
            );
          }

          return {
            name: param.getName(),
            required: !(param.flags & ts.SymbolFlags.Optional),
            schema: formatTypeReference(paramType, typeChecker, typeRefs, referencedTypes),
          };
        });

        const returnType = signature.getReturnType();
        if (returnType) {
          collectReferencedTypes(returnType, typeChecker, referencedTypes);
        }

        schema.properties[methodName] = {
          type: 'function',
          parameters,
          returns: {
            schema: returnType
              ? formatTypeReference(returnType, typeChecker, typeRefs, referencedTypes)
              : { type: 'void' },
          },
        };

        if (!member.questionToken) {
          required.push(methodName);
        }
      }
    }
    // Handle call signatures: interface Logger { (msg: string): void }
    else if (ts.isCallSignatureDeclaration(member)) {
      const signature = typeChecker.getSignatureFromDeclaration(member);

      if (signature) {
        const parameters = signature.getParameters().map((param) => {
          const paramDecl = param.declarations?.find(ts.isParameter) as
            | TS.ParameterDeclaration
            | undefined;
          const paramType = paramDecl
            ? typeChecker.getTypeAtLocation(paramDecl)
            : typeChecker.getTypeOfSymbolAtLocation(param, member);

          collectReferencedTypes(paramType, typeChecker, referencedTypes);

          if (paramDecl) {
            const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);
            return structureParameter(
              param,
              paramDecl,
              paramType,
              typeChecker,
              typeRefs,
              null,
              paramDoc,
              referencedTypes,
            );
          }

          return {
            name: param.getName(),
            required: !(param.flags & ts.SymbolFlags.Optional),
            schema: formatTypeReference(paramType, typeChecker, typeRefs, referencedTypes),
          };
        });

        const returnType = signature.getReturnType();
        if (returnType) {
          collectReferencedTypes(returnType, typeChecker, referencedTypes);
        }

        callSignatures.push({
          parameters,
          returns: {
            schema: returnType
              ? formatTypeReference(returnType, typeChecker, typeRefs, referencedTypes)
              : { type: 'void' },
          },
        });
      }
    }
    // Handle construct signatures: interface Constructor { new (arg: string): Instance }
    else if (ts.isConstructSignatureDeclaration(member)) {
      const signature = typeChecker.getSignatureFromDeclaration(member);

      if (signature) {
        const parameters = signature.getParameters().map((param) => {
          const paramDecl = param.declarations?.find(ts.isParameter) as
            | TS.ParameterDeclaration
            | undefined;
          const paramType = paramDecl
            ? typeChecker.getTypeAtLocation(paramDecl)
            : typeChecker.getTypeOfSymbolAtLocation(param, member);

          collectReferencedTypes(paramType, typeChecker, referencedTypes);

          if (paramDecl) {
            const paramDoc = getParameterDocumentation(param, paramDecl, typeChecker);
            return structureParameter(
              param,
              paramDecl,
              paramType,
              typeChecker,
              typeRefs,
              null,
              paramDoc,
              referencedTypes,
            );
          }

          return {
            name: param.getName(),
            required: !(param.flags & ts.SymbolFlags.Optional),
            schema: formatTypeReference(paramType, typeChecker, typeRefs, referencedTypes),
          };
        });

        const returnType = signature.getReturnType();
        if (returnType) {
          collectReferencedTypes(returnType, typeChecker, referencedTypes);
        }

        constructSignatures.push({
          parameters,
          returns: {
            schema: returnType
              ? formatTypeReference(returnType, typeChecker, typeRefs, referencedTypes)
              : { type: 'object' },
          },
        });
      }
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }

  if (callSignatures.length > 0) {
    schema.callSignatures = callSignatures;
  }

  if (constructSignatures.length > 0) {
    schema.constructSignatures = constructSignatures;
  }

  return schema;
}
