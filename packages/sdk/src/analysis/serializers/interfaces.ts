import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';
import { formatTypeReference } from '../../utils/parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';

export interface InterfaceSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeInterface(
  declaration: ts.InterfaceDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): InterfaceSerializationResult {
  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'interface',
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  const schema = interfaceToSchema(
    declaration,
    context.checker,
    context.typeRegistry.getTypeRefs(),
    context.typeRegistry.getReferencedTypes(),
  );

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'interface',
    schema,
    description: getJSDocComment(symbol, context.checker),
    source: getSourceLocation(declaration),
  };

  return {
    exportEntry,
    typeDefinition,
  };
}

function interfaceToSchema(
  iface: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: 'object',
    properties: {},
  };

  const required: string[] = [];

  for (const prop of iface.members.filter(ts.isPropertySignature)) {
    const propName = prop.name?.getText() || '';

    if (prop.type) {
      const propType = typeChecker.getTypeAtLocation(prop.type);
      collectReferencedTypes(propType, typeChecker, referencedTypes);
    }

    schema.properties[propName] = prop.type
      ? formatTypeReference(
          typeChecker.getTypeAtLocation(prop.type),
          typeChecker,
          typeRefs,
          referencedTypes,
        )
      : { type: 'any' };

    if (!prop.questionToken) {
      required.push(propName);
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}
