import type * as TS from 'typescript';
import { ts } from '../../ts-module';
import { formatTypeReference } from '../../utils/parameter-utils';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { serializeTypeParameterDeclarations } from '../../utils/type-parameter-utils';
import { collectReferencedTypes } from '../../utils/type-utils';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast-utils';
import type { ExportDefinition, TypeDefinition, TypeReference } from '../spec-types';
import type { SerializerContext } from './functions';
import { extractPresentationMetadata } from './presentation';

type SpecTypeAliasKind = 'alias' | 'conditional' | 'mapped' | 'template-literal' | 'infer';

interface ConditionalTypeInfo {
  checkType: string;
  extendsType: string;
  trueType: string;
  falseType: string;
}

interface MappedTypeInfo {
  typeParameter: string;
  nameType?: string;
  valueType?: string;
  readonly?: '+' | '-' | true;
  optional?: '+' | '-' | true;
}

interface TypeAliasAnalysis {
  typeAliasKind: SpecTypeAliasKind;
  conditionalType?: ConditionalTypeInfo;
  mappedType?: MappedTypeInfo;
}

/**
 * Analyze a type alias declaration to determine its kind and extract structural details.
 */
function analyzeTypeAliasKind(typeNode: TS.TypeNode): TypeAliasAnalysis {
  // Check AST node for conditional type
  if (ts.isConditionalTypeNode(typeNode)) {
    return {
      typeAliasKind: 'conditional',
      conditionalType: {
        checkType: typeNode.checkType.getText(),
        extendsType: typeNode.extendsType.getText(),
        trueType: typeNode.trueType.getText(),
        falseType: typeNode.falseType.getText(),
      },
    };
  }

  // Check AST node for mapped type
  if (ts.isMappedTypeNode(typeNode)) {
    const readonlyToken = typeNode.readonlyToken;
    const questionToken = typeNode.questionToken;

    return {
      typeAliasKind: 'mapped',
      mappedType: {
        typeParameter: typeNode.typeParameter.getText(),
        nameType: typeNode.nameType?.getText(),
        valueType: typeNode.type?.getText(),
        readonly: readonlyToken
          ? readonlyToken.kind === ts.SyntaxKind.MinusToken
            ? '-'
            : readonlyToken.kind === ts.SyntaxKind.PlusToken
              ? '+'
              : true
          : undefined,
        optional: questionToken
          ? questionToken.kind === ts.SyntaxKind.MinusToken
            ? '-'
            : questionToken.kind === ts.SyntaxKind.PlusToken
              ? '+'
              : true
          : undefined,
      },
    };
  }

  // Check for template literal types
  if (ts.isTemplateLiteralTypeNode(typeNode)) {
    return { typeAliasKind: 'template-literal' };
  }

  // Check for infer types (usually inside conditional)
  if (containsInferType(typeNode)) {
    return { typeAliasKind: 'infer' };
  }

  return { typeAliasKind: 'alias' };
}

/**
 * Recursively check if a type node contains an infer type.
 */
function containsInferType(node: TS.Node): boolean {
  if (ts.isInferTypeNode(node)) {
    return true;
  }

  return ts.forEachChild(node, containsInferType) ?? false;
}

export interface TypeAliasSerializationResult {
  exportEntry: ExportDefinition;
  typeDefinition?: TypeDefinition;
}

export function serializeTypeAlias(
  declaration: TS.TypeAliasDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): TypeAliasSerializationResult {
  const { checker, typeRegistry } = context;
  const typeRefs = typeRegistry.getTypeRefs();
  const referencedTypes = typeRegistry.getReferencedTypes();
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);
  const metadata = extractPresentationMetadata(parsedDoc);
  const typeParameters = serializeTypeParameterDeclarations(
    declaration.typeParameters,
    checker,
    referencedTypes,
  );

  // Analyze the type alias kind and extract structural information
  const typeAnalysis = analyzeTypeAliasKind(declaration.type);

  const exportEntry: ExportDefinition = {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'type',
    deprecated: isSymbolDeprecated(symbol),
    type: typeToRef(declaration.type, checker, typeRefs, referencedTypes),
    description,
    source: getSourceLocation(declaration),
    typeParameters,
    tags: parsedDoc?.tags,
    examples: parsedDoc?.examples,
    // Add type alias structural information
    typeAliasKind: typeAnalysis.typeAliasKind !== 'alias' ? typeAnalysis.typeAliasKind : undefined,
    conditionalType: typeAnalysis.conditionalType,
    mappedType: typeAnalysis.mappedType,
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
    ...metadata,
    kind: 'type',
    description,
    source: getSourceLocation(declaration),
    tags: parsedDoc?.tags,
    // Add type alias structural information
    typeAliasKind: typeAnalysis.typeAliasKind !== 'alias' ? typeAnalysis.typeAliasKind : undefined,
    conditionalType: typeAnalysis.conditionalType,
    mappedType: typeAnalysis.mappedType,
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
  node: TS.TypeNode,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes: Set<string>,
): TypeReference {
  const type = typeChecker.getTypeAtLocation(node);
  collectReferencedTypes(type, typeChecker, referencedTypes);
  return formatTypeReference(type, typeChecker, typeRefs, referencedTypes);
}
