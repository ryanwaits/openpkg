import * as ts from 'typescript';

export interface ParsedParam {
  name: string;
  description: string;
  type?: string;
}

export interface ParsedJSDoc {
  description: string;
  params: ParsedParam[];
  returns?: string;
  examples?: string[];
}

/**
 * Parse JSDoc/TSDoc comments to extract structured information
 */
export function parseJSDocComment(
  symbol: ts.Symbol,
  typeChecker: ts.TypeChecker,
  sourceFileOverride?: ts.SourceFile,
): ParsedJSDoc | null {
  const node = symbol.valueDeclaration || symbol.declarations?.[0];
  if (!node) return null;

  const sourceFile = sourceFileOverride || node.getSourceFile();
  const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.pos);

  if (!commentRanges || commentRanges.length === 0) {
    return null;
  }

  // Get the last comment (usually the JSDoc)
  const lastComment = commentRanges[commentRanges.length - 1];
  const commentText = sourceFile.text.substring(lastComment.pos, lastComment.end);

  return parseJSDocText(commentText);
}

/**
 * Find a function/method node in a source file by name and approximate position
 */
export function findNodeInSourceFile(
  sourceFile: ts.SourceFile,
  nodeName: string,
  approximateLine: number,
): ts.Node | null {
  let closestNode: ts.Node | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  function visit(node: ts.Node) {
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
 * Parse JSDoc text to extract structured information
 */
export function parseJSDocText(commentText: string): ParsedJSDoc {
  const result: ParsedJSDoc = {
    description: '',
    params: [],
    examples: [],
  };

  // Remove comment delimiters
  const cleanedText = commentText
    .replace(/^\/\*\*\s*/, '')
    .replace(/\s*\*\/$/, '')
    .replace(/^\s*\* ?/gm, '');

  const lines = cleanedText.split('\n');
  let currentTag = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);

    if (tagMatch) {
      // Process previous tag
      if (currentTag) {
        processTag(result, currentTag, currentContent.join('\n'));
      }

      currentTag = tagMatch[1];
      currentContent = tagMatch[2] ? [tagMatch[2]] : [];
    } else if (currentTag) {
      // Continue collecting content for current tag
      currentContent.push(line);
    } else {
      // Description lines before any tags
      if (line.trim()) {
        result.description += (result.description ? '\n' : '') + line;
      }
    }
  }

  // Process last tag
  if (currentTag) {
    processTag(result, currentTag, currentContent.join('\n'));
  }

  return result;
}

function processTag(result: ParsedJSDoc, tag: string, content: string) {
  switch (tag) {
    case 'param':
    case 'parameter': {
      const paramMatch = content.match(/^(?:\{([^}]+)\}\s+)?(\S+)(?:\s+-\s+)?(.*)$/);
      if (paramMatch) {
        const [, type, name, description] = paramMatch;
        result.params.push({
          name: name || '',
          description: description || '',
          type: type,
        });
      }
      break;
    }
    case 'returns':
    case 'return': {
      result.returns = content;
      break;
    }
    case 'example': {
      result.examples?.push(content);
      break;
    }
  }
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
      const [prefix, propertyName] = param.name.split('.', 2);
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
  param: ts.Symbol,
  paramDecl: ts.ParameterDeclaration,
  typeChecker: ts.TypeChecker,
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
