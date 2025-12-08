import type * as TS from 'typescript';
import { ts } from '../../ts-module';
import { parseJSDocComment } from '../../utils/tsdoc-utils';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast-utils';
import type { ExportDefinition } from '../spec-types';
import type { SerializerContext } from './functions';
import { extractPresentationMetadata } from './presentation';

export interface NamespaceMember {
  id: string;
  name: string;
  kind: 'function' | 'variable' | 'interface' | 'type' | 'enum' | 'class' | 'namespace';
  description?: string;
  // Nested members for sub-namespaces
  members?: NamespaceMember[];
}

export function serializeNamespace(
  declaration: TS.ModuleDeclaration,
  symbol: TS.Symbol,
  context: SerializerContext,
): ExportDefinition {
  const { checker } = context;
  const parsedDoc = parseJSDocComment(symbol, checker);
  const description = parsedDoc?.description ?? getJSDocComment(symbol, checker);
  const metadata = extractPresentationMetadata(parsedDoc);

  const members = extractNamespaceMembers(declaration, checker);

  // Detect module augmentation: declare module "name" { ... }
  // Module augmentations have a string literal as the name
  const isAugmentation = ts.isStringLiteral(declaration.name);
  const augmentedModule = isAugmentation ? declaration.name.text : undefined;

  return {
    id: symbol.getName(),
    name: symbol.getName(),
    ...metadata,
    kind: 'namespace',
    deprecated: isSymbolDeprecated(symbol),
    description,
    source: getSourceLocation(declaration),
    members: members.length > 0 ? members : undefined,
    tags: parsedDoc?.tags,
    examples: parsedDoc?.examples,
    isAugmentation: isAugmentation || undefined,
    augmentedModule,
  };
}

function extractNamespaceMembers(
  declaration: TS.ModuleDeclaration,
  checker: TS.TypeChecker,
): NamespaceMember[] {
  const members: NamespaceMember[] = [];

  // Handle nested namespace declarations like `namespace A.B.C`
  let body = declaration.body;

  // Navigate through nested module declarations
  while (body && ts.isModuleDeclaration(body)) {
    body = body.body;
  }

  if (!body || !ts.isModuleBlock(body)) {
    return members;
  }

  for (const statement of body.statements) {
    // Skip non-exported members
    const hasExportModifier =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);

    if (!hasExportModifier) {
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

      members.push({
        id: statement.name.getText(),
        name: statement.name.getText(),
        kind: 'function',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
      });
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const memberSymbol = checker.getSymbolAtLocation(decl.name);
          const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

          members.push({
            id: decl.name.getText(),
            name: decl.name.getText(),
            kind: 'variable',
            description:
              memberDoc?.description ??
              (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
          });
        }
      }
    } else if (ts.isInterfaceDeclaration(statement) && statement.name) {
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

      members.push({
        id: statement.name.getText(),
        name: statement.name.getText(),
        kind: 'interface',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
      });
    } else if (ts.isTypeAliasDeclaration(statement) && statement.name) {
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

      members.push({
        id: statement.name.getText(),
        name: statement.name.getText(),
        kind: 'type',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
      });
    } else if (ts.isEnumDeclaration(statement) && statement.name) {
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

      members.push({
        id: statement.name.getText(),
        name: statement.name.getText(),
        kind: 'enum',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
      });
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;

      members.push({
        id: statement.name.getText(),
        name: statement.name.getText(),
        kind: 'class',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
      });
    } else if (ts.isModuleDeclaration(statement) && statement.name) {
      // Nested namespace
      const memberSymbol = checker.getSymbolAtLocation(statement.name);
      const memberDoc = memberSymbol ? parseJSDocComment(memberSymbol, checker) : null;
      const nestedMembers = extractNamespaceMembers(statement, checker);

      members.push({
        id: ts.isIdentifier(statement.name) ? statement.name.getText() : statement.name.text,
        name: ts.isIdentifier(statement.name) ? statement.name.getText() : statement.name.text,
        kind: 'namespace',
        description:
          memberDoc?.description ??
          (memberSymbol ? getJSDocComment(memberSymbol, checker) : undefined),
        members: nestedMembers.length > 0 ? nestedMembers : undefined,
      });
    }
  }

  return members;
}
