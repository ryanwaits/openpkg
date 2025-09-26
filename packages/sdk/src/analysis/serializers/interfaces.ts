import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';
import { formatTypeReference } from '../../utils/parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { parseJSDocComment } from '../../utils/tsdoc-utils';

export interface InterfaceSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeInterface(
  declaration: ts.InterfaceDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): InterfaceSerializationResult {
  const parsedDoc = parseJSDocComment(symbol, context.checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, context.checker);

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'interface',
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
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
  iface: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): Record<string, unknown> {
  const schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  } = {
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
