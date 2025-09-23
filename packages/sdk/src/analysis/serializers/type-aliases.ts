import * as ts from 'typescript';
import type { ExportDefinition, TypeDefinition, TypeReference } from '../spec-types';
import { getJSDocComment, getSourceLocation } from '../ast-utils';
import type { SerializerContext } from './functions';
import { formatTypeReference } from '../../utils/parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';

export interface TypeAliasSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeTypeAlias(
  declaration: ts.TypeAliasDeclaration,
  symbol: ts.Symbol,
  context: SerializerContext,
): TypeAliasSerializationResult {
  const { checker, typeRegistry } = context;
  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'type',
    type: typeToRef(declaration.type, checker, typeRefs, referencedTypes),
    description: getJSDocComment(symbol, checker),
    source: getSourceLocation(declaration),
  };

  const aliasType = checker.getTypeAtLocation(declaration.type);
  const aliasName = symbol.getName();

  // Temporarily remove the alias from the registry so we expand its structure
  const existingRef = typeRefs.get(aliasName);
  if (existingRef) {
    typeRefs.delete(aliasName);
  }

  const aliasSchema = formatTypeReference(aliasType, checker, typeRefs, undefined);

  if (existingRef) {
    typeRefs.set(aliasName, existingRef);
  }

  const typeDefinition: TypeDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    kind: 'type',
    description: getJSDocComment(symbol, checker),
    source: getSourceLocation(declaration),
  };

  if (typeof aliasSchema === 'string') {
    typeDefinition.type = aliasSchema;
  } else if (aliasSchema && Object.keys(aliasSchema).length > 0) {
    typeDefinition.schema = aliasSchema;
  } else {
    typeDefinition.type = declaration.type.getText();
  }

  return {
    exportEntry,
    typeDefinition,
  };
}

function typeToRef(
  node: ts.TypeNode,
  typeChecker: ts.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): TypeReference {
  const type = typeChecker.getTypeAtLocation(node);
  collectReferencedTypes(type, typeChecker, referencedTypes);
  return formatTypeReference(type, typeChecker, typeRefs, referencedTypes);
}
