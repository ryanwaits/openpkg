import type * as TS from 'typescript';
import { ts } from '../../ts-module';
import { formatTypeReference } from '../../utils/parameter-utils';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
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
