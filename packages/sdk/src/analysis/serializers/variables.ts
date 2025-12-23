import type * as TS from 'typescript';
import { extractSchemaType, isSchemaType } from '../../extract/schema';
import { formatTypeReference } from '../../utils/parameter-utils';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast-utils';
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
      deprecated: isSymbolDeprecated(symbol),
      signatures: serializeCallSignatures(callSignatures, symbol, context, parsedDoc),
      description,
      source: getSourceLocation(declaration.initializer ?? declaration),
      examples: parsedDoc?.examples,
      tags: parsedDoc?.tags,
    };
  }

  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();
  const symbolName = symbol.getName();

  // Priority 1: Standard Schema runtime extraction (richest output)
  // Contains full JSON Schema with formats, patterns, constraints
  const standardSchema = context.detectedSchemas?.get(symbolName);
  if (standardSchema) {
    return {
      id: symbolName,
      name: symbolName,
      ...metadata,
      kind: 'variable',
      deprecated: isSymbolDeprecated(symbol),
      schema: standardSchema.schema,
      description,
      source: getSourceLocation(declaration),
      tags: [
        ...(parsedDoc?.tags ?? []),
        { name: 'schemaLibrary', text: standardSchema.vendor },
        { name: 'schemaSource', text: 'standard-schema' },
      ],
      examples: parsedDoc?.examples,
    };
  }

  // Priority 2: Static schema extraction (Zod, Valibot, TypeBox, ArkType)
  // TypeScript Compiler API - no runtime needed
  if (isSchemaType(variableType, checker)) {
    const schemaResult = extractSchemaType(variableType, checker);
    if (schemaResult?.outputType) {
      // Format the extracted output type as the variable's type
      collectReferencedTypes(schemaResult.outputType, checker, referencedTypes);
      const outputTypeRef = formatTypeReference(
        schemaResult.outputType,
        checker,
        typeRefs,
        referencedTypes,
      );

      return {
        id: symbolName,
        name: symbolName,
        ...metadata,
        kind: 'variable',
        deprecated: isSymbolDeprecated(symbol),
        type: outputTypeRef,
        description,
        source: getSourceLocation(declaration),
        tags: [
          ...(parsedDoc?.tags ?? []),
          { name: 'schemaLibrary', text: schemaResult.adapter.id },
          { name: 'schemaSource', text: 'static-ast' },
        ],
        examples: parsedDoc?.examples,
      };
    }
  }

  // Priority 3: Plain variable - no schema extraction
  return {
    id: symbolName,
    name: symbolName,
    ...metadata,
    kind: 'variable',
    deprecated: isSymbolDeprecated(symbol),
    type: typeToRef(declaration, checker, typeRefs, referencedTypes),
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
    examples: parsedDoc?.examples,
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
