import type * as TS from 'typescript';
import { ts } from '../ts-module';
import {
  parseJSDocBlock,
  parseParamContent,
  parseReturnContent,
  type ParsedJSDocInfo,
  type ParsedParamInfo,
} from './tsdoc-parser';

export interface ParsedParam {
  name: string;
  description: string;
  type?: string;
}

export interface ParsedTag {
  name: string;
  text: string;
}

export interface ParsedJSDoc {
  description: string;
  params: ParsedParam[];
  returns?: string;
  returnsType?: string;
  examples?: string[];
  tags?: ParsedTag[];
  rawParamNames?: string[];
}

// Re-export for convenience
export { parseParamContent, parseReturnContent } from './tsdoc-parser';

/**
 * Find the last JSDoc block comment (starts with /**) in a list of comment ranges,
 * ignoring single-line comments like // biome-ignore or // eslint-disable
 */
function findJSDocComment(
  commentRanges: readonly TS.CommentRange[] | undefined,
  sourceText: string,
): TS.CommentRange | undefined {
  if (!commentRanges || commentRanges.length === 0) {
    return undefined;
  }

  for (let i = commentRanges.length - 1; i >= 0; i--) {
    const range = commentRanges[i];
    const text = sourceText.substring(range.pos, range.end);
    if (text.startsWith('/**')) {
      return range;
    }
  }

  return undefined;
}

/**
 * Parse JSDoc/TSDoc comments to extract structured information
 */
export function parseJSDocComment(
  symbol: TS.Symbol,
  _typeChecker: TS.TypeChecker,
  sourceFileOverride?: TS.SourceFile,
): ParsedJSDoc | null {
  const node = symbol.valueDeclaration || symbol.declarations?.[0];
  if (!node) return null;

  const sourceFile = sourceFileOverride || node.getSourceFile();

  // Try to find JSDoc on the node itself
  let jsdocComment = findJSDocComment(
    ts.getLeadingCommentRanges(sourceFile.text, node.pos),
    sourceFile.text,
  );

  // For variable declarations, JSDoc is often on the parent VariableStatement
  // e.g., `/** docs */ export const PI = 3.14;` - JSDoc is on the statement, not the declaration
  if (!jsdocComment && ts.isVariableDeclaration(node) && node.parent?.parent) {
    const statement = node.parent.parent; // VariableDeclaration -> VariableDeclarationList -> VariableStatement
    if (ts.isVariableStatement(statement)) {
      jsdocComment = findJSDocComment(
        ts.getLeadingCommentRanges(sourceFile.text, statement.pos),
        sourceFile.text,
      );
    }
  }

  if (!jsdocComment) {
    return null;
  }

  const commentText = sourceFile.text.substring(jsdocComment.pos, jsdocComment.end);

  return parseJSDocText(commentText);
}

/**
 * Find a function/method node in a source file by name and approximate position
 */
export function findNodeInSourceFile(
  sourceFile: TS.SourceFile,
  nodeName: string,
  approximateLine: number,
): TS.Node | null {
  let closestNode: TS.Node | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  function visit(node: TS.Node) {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
      const name = node.name?.getText();
      if (name === nodeName) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const distance = Math.abs(line - approximateLine);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = node;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return closestNode;
}

/**
 * Parse JSDoc text to extract structured information.
 * Uses the improved brace-depth-aware parser from tsdoc-parser.ts.
 */
export function parseJSDocText(commentText: string): ParsedJSDoc {
  const parsed = parseJSDocBlock(commentText);

  // Convert to legacy format
  const result: ParsedJSDoc = {
    description: parsed.description,
    params: parsed.params.map((p) => ({
      name: p.name,
      description: p.description,
      type: p.type,
    })),
    examples: parsed.examples.length > 0 ? parsed.examples : undefined,
    tags: parsed.tags.length > 0 ? parsed.tags : undefined,
    rawParamNames: parsed.rawParamNames,
  };

  // Extract returns info
  if (parsed.returns) {
    result.returns = parsed.returns.description;
    result.returnsType = parsed.returns.type;
  }

  return result;
}

/**
 * Extract parameter names from @param tags for destructured parameters
 * @param parsedDoc - Parsed JSDoc
 * @param paramName - The parameter name from TypeScript (e.g., "__0" or "opts")
 * @returns Map of property names to their descriptions
 */
export function extractDestructuredParams(
  parsedDoc: ParsedJSDoc,
  paramName: string,
): Map<string, string> {
  const destructuredParams = new Map<string, string>();

  // Look for params that match the pattern: paramName.propertyName
  const paramPrefix = `${paramName}.`;

  for (const param of parsedDoc.params) {
    if (param.name.startsWith(paramPrefix)) {
      const propertyName = param.name.substring(paramPrefix.length);
      destructuredParams.set(propertyName, param.description);
    } else if (param.name.includes('.') && paramName === '__0') {
      // Handle case where TSDoc uses "opts.property" but TS shows "__0"
      const [_prefix, propertyName] = param.name.split('.', 2);
      if (propertyName) {
        destructuredParams.set(propertyName, param.description);
      }
    }
  }

  return destructuredParams;
}

/**
 * Get structured parameter documentation including destructured properties
 */
export function getParameterDocumentation(
  param: TS.Symbol,
  paramDecl: TS.ParameterDeclaration,
  typeChecker: TS.TypeChecker,
): {
  description: string;
  destructuredProperties?: Array<{ name: string; description: string }>;
} {
  const result: ParameterDocumentation = {
    description: '',
  };

  // Get the function symbol to access its JSDoc
  const funcNode = paramDecl.parent;
  if (ts.isFunctionDeclaration(funcNode) || ts.isFunctionExpression(funcNode)) {
    const funcSymbol = typeChecker.getSymbolAtLocation(funcNode.name || funcNode);
    if (funcSymbol) {
      const parsedDoc = parseJSDocComment(funcSymbol, typeChecker);
      if (parsedDoc) {
        // Find the param description
        const paramName = param.getName();
        const paramDoc = parsedDoc.params.find(
          (p) => p.name === paramName || p.name.split('.')[0] === paramName,
        );

        if (paramDoc) {
          result.description = paramDoc.description;
        }

        // Check for destructured properties
        const destructuredProps = extractDestructuredParams(parsedDoc, paramName);
        if (destructuredProps.size > 0) {
          result.destructuredProperties = Array.from(destructuredProps.entries()).map(
            ([name, description]) => ({
              name,
              description,
            }),
          );
        }
      }
    }
  }

  return result;
}

export interface ParameterDocumentation {
  description: string;
  destructuredProperties?: Array<{ name: string; description: string }>;
}
