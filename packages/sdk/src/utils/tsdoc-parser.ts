/**
 * Improved JSDoc/TSDoc parser with brace-depth-aware tokenization.
 *
 * Handles:
 * - Nested braces in types: {Record<string, {foo: Bar}>}
 * - Multi-line descriptions
 * - TSDoc modifiers: @param {string} [name=default] - desc
 * - Optional parameters: @param [name]
 * - Default values: @param [name=value]
 */

import type * as TS from 'typescript';
import { ts } from '../ts-module';

export interface ParsedParamInfo {
  /** Parameter name (without brackets) */
  name: string;
  /** Parameter description */
  description: string;
  /** Type annotation from {type} syntax */
  type?: string;
  /** Whether parameter is marked optional with brackets [name] */
  isOptional: boolean;
  /** Default value if specified [name=default] */
  defaultValue?: string;
}

export interface ParsedReturnInfo {
  /** Return type from {type} syntax */
  type?: string;
  /** Return description */
  description: string;
}

export interface ParsedThrowsInfo {
  /** Exception type from {type} syntax */
  type?: string;
  /** Description of when/why thrown */
  description: string;
}

export interface ParsedTagInfo {
  /** Tag name without @ */
  name: string;
  /** Full tag content */
  text: string;
  // Structured fields for known JSDoc tags
  /** Parameter name for @param tags */
  paramName?: string;
  /** Type annotation from {type} syntax */
  typeAnnotation?: string;
  /** Reference target for @see, @link tags */
  reference?: string;
  /** Language identifier from fenced code blocks */
  language?: string;
  /** Version string for @since, @deprecated tags */
  version?: string;
  /** Reason/message for @deprecated tags */
  reason?: string;
}

export interface ParsedExampleInfo {
  /** The example code */
  code: string;
  /** Short title for the example */
  title?: string;
  /** Longer description of what the example demonstrates */
  description?: string;
  /** Programming language (from fenced code block) */
  language?: string;
}

export interface ParsedJSDocInfo {
  /** Main description text */
  description: string;
  /** Parsed @param tags */
  params: ParsedParamInfo[];
  /** Parsed @returns/@return tag */
  returns?: ParsedReturnInfo;
  /** Parsed @throws/@throw/@exception tags */
  throws: ParsedThrowsInfo[];
  /** @example blocks (raw strings for backwards compatibility) */
  examples: string[];
  /** Structured @example blocks with metadata */
  structuredExamples: ParsedExampleInfo[];
  /** @see references (symbol/type names extracted from tags) */
  seeAlso: string[];
  /** All other tags */
  tags: ParsedTagInfo[];
  /** Original raw @param names for compatibility */
  rawParamNames: string[];
}

/**
 * Parse a JSDoc comment block into structured information.
 *
 * @param commentText - The raw comment text including delimiters
 * @returns Parsed JSDoc information
 */
export function parseJSDocBlock(commentText: string): ParsedJSDocInfo {
  const result: ParsedJSDocInfo = {
    description: '',
    params: [],
    throws: [],
    examples: [],
    structuredExamples: [],
    seeAlso: [],
    tags: [],
    rawParamNames: [],
  };

  // Remove comment delimiters and asterisks
  const cleanedText = cleanJSDocComment(commentText);
  const lines = cleanedText.split('\n');

  let currentTag: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);

    if (tagMatch) {
      // Finish previous tag
      if (currentTag) {
        processTagContent(result, currentTag, currentContent.join('\n'));
      }

      currentTag = tagMatch[1];
      currentContent = tagMatch[2] ? [tagMatch[2]] : [];
    } else if (currentTag) {
      // Continue current tag content
      currentContent.push(line);
    } else {
      // Description text
      if (line.trim()) {
        const processed = processInlineLinks(line).trimEnd();
        result.description = result.description
          ? `${result.description}\n${processed}`
          : processed;
      }
    }
  }

  // Process final tag
  if (currentTag) {
    processTagContent(result, currentTag, currentContent.join('\n'));
  }

  // Clean up empty arrays
  if (result.examples.length === 0) {
    result.examples = [];
  }

  return result;
}

/**
 * Parse a @param tag content with support for nested braces and modifiers.
 *
 * Formats supported:
 * - name - description
 * - {type} name - description
 * - {type} [name] - description
 * - {type} [name=default] - description
 * - name.property - description (destructured)
 */
export function parseParamContent(content: string): ParsedParamInfo | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  let remaining = trimmed;
  let type: string | undefined;

  // Extract type if present: {type}
  if (remaining.startsWith('{')) {
    const typeEnd = findMatchingBrace(remaining, 0);
    if (typeEnd > 0) {
      type = remaining.slice(1, typeEnd).trim();
      remaining = remaining.slice(typeEnd + 1).trim();
    }
  }

  // Extract name (possibly with brackets for optional)
  let name = '';
  let isOptional = false;
  let defaultValue: string | undefined;

  if (remaining.startsWith('[')) {
    // Optional parameter: [name] or [name=default]
    const bracketEnd = remaining.indexOf(']');
    if (bracketEnd > 0) {
      isOptional = true;
      const bracketContent = remaining.slice(1, bracketEnd);
      const eqIndex = bracketContent.indexOf('=');

      if (eqIndex >= 0) {
        name = bracketContent.slice(0, eqIndex).trim();
        defaultValue = bracketContent.slice(eqIndex + 1).trim();
      } else {
        name = bracketContent.trim();
      }

      remaining = remaining.slice(bracketEnd + 1).trim();
    }
  } else {
    // Regular parameter name - find next whitespace or dash
    const nameMatch = remaining.match(/^(\S+)/);
    if (nameMatch) {
      name = nameMatch[1];
      remaining = remaining.slice(name.length).trim();
    }
  }

  if (!name) return null;

  // Extract description (skip leading dash if present)
  let description = remaining;
  if (description.startsWith('-')) {
    description = description.slice(1).trim();
  }

  description = processInlineLinks(description);

  return {
    name,
    description,
    type,
    isOptional,
    defaultValue,
  };
}

/**
 * Parse a @returns/@return tag content.
 */
export function parseReturnContent(content: string): ParsedReturnInfo {
  const trimmed = content.trim();
  let remaining = trimmed;
  let type: string | undefined;

  // Extract type if present: {type}
  if (remaining.startsWith('{')) {
    const typeEnd = findMatchingBrace(remaining, 0);
    if (typeEnd > 0) {
      type = remaining.slice(1, typeEnd).trim();
      remaining = remaining.slice(typeEnd + 1).trim();
    }
  }

  return {
    type,
    description: processInlineLinks(remaining),
  };
}

/**
 * Parse a @throws/@throw/@exception tag content.
 *
 * Formats supported:
 * - description
 * - {ErrorType} description
 * - ErrorType description (legacy)
 */
export function parseThrowsContent(content: string): ParsedThrowsInfo {
  const trimmed = content.trim();
  let remaining = trimmed;
  let type: string | undefined;

  // Extract type if present: {type}
  if (remaining.startsWith('{')) {
    const typeEnd = findMatchingBrace(remaining, 0);
    if (typeEnd > 0) {
      type = remaining.slice(1, typeEnd).trim();
      remaining = remaining.slice(typeEnd + 1).trim();
    }
  }

  return {
    type,
    description: processInlineLinks(remaining),
  };
}

/**
 * Parse an @example tag content into structured metadata.
 *
 * Supports formats:
 * - Plain code (no fences)
 * - Fenced code: ```language\ncode\n```
 * - Title on first line followed by fenced code
 * - Title, description text, then fenced code
 */
export function parseExampleContent(content: string): ParsedExampleInfo | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  let title: string | undefined;
  let description: string | undefined;
  let language: string | undefined;
  let codeStartIndex = 0;

  // Check first line for title (non-code line before code block)
  // Skip if it's a code fence or looks like code
  const firstLine = lines[0]?.trim() ?? '';
  const looksLikeCode = /^(import|const|let|var|function|class|export|async|await|if|for|while|return|\/\/|\/\*|\{|\[)/.test(firstLine);

  if (firstLine && !firstLine.startsWith('```') && !looksLikeCode) {
    title = firstLine;
    codeStartIndex = 1;
  }

  // Find code block
  const codeBlockStart = lines.findIndex((l, i) => i >= codeStartIndex && l.trim().startsWith('```'));

  if (codeBlockStart !== -1) {
    // Extract language from ``` fence
    const fenceMatch = lines[codeBlockStart].match(/```(\w+)?/);
    language = fenceMatch?.[1];

    // Description is lines between title and code block
    if (codeBlockStart > codeStartIndex) {
      const descLines = lines.slice(codeStartIndex, codeBlockStart).filter(l => l.trim());
      if (descLines.length > 0) {
        description = descLines.join('\n').trim();
      }
    }

    // Extract code (between ``` fences)
    const codeBlockEnd = lines.findIndex((l, i) => i > codeBlockStart && l.trim() === '```');
    const codeLines = codeBlockEnd === -1
      ? lines.slice(codeBlockStart + 1)
      : lines.slice(codeBlockStart + 1, codeBlockEnd);
    const code = codeLines.join('\n');

    return { code, title, description, language };
  }

  // No code block - treat remaining content as code
  const code = lines.slice(codeStartIndex).join('\n').trim();

  // Default to typescript if no language specified
  return { code, title, language: 'ts' };
}

/**
 * Find the index of the closing brace matching the opening brace at startIndex.
 * Handles nested braces and angle brackets.
 */
function findMatchingBrace(text: string, startIndex: number): number {
  if (text[startIndex] !== '{') return -1;

  let depth = 0;
  let angleDepth = 0;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    switch (char) {
      case '{':
        depth++;
        break;
      case '}':
        depth--;
        if (depth === 0) return i;
        break;
      case '<':
        angleDepth++;
        break;
      case '>':
        if (angleDepth > 0) angleDepth--;
        break;
    }
  }

  return -1;
}

/**
 * Remove JSDoc comment delimiters and leading asterisks.
 */
function cleanJSDocComment(text: string): string {
  return text
    .replace(/^\/\*\*\s*/, '') // Remove opening /**
    .replace(/\s*\*\/$/, '') // Remove closing */
    .replace(/^\s*\* ?/gm, '') // Remove leading * from each line
    .replace(/\n\/\s*$/, ''); // Remove trailing /
}

/**
 * Process inline {@link} tags, replacing them with their label or target.
 */
function processInlineLinks(text: string): string {
  return text.replace(/\{@link\s+([^}]+)\}/g, (_match, body) => {
    const trimmed = body.trim();

    // Handle pipe notation: {target|label}
    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex >= 0) {
      return trimmed.slice(pipeIndex + 1).trim() || trimmed.slice(0, pipeIndex).trim();
    }

    // Handle space notation: {target label text}
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      return parts.slice(1).join(' ');
    }

    return parts[0] ?? '';
  });
}

/**
 * Process a single tag and add it to the result.
 */
function processTagContent(result: ParsedJSDocInfo, tag: string, content: string): void {
  const trimmedContent = content.trim();

  switch (tag.toLowerCase()) {
    case 'param':
    case 'parameter':
    case 'arg':
    case 'argument': {
      const parsed = parseParamContent(trimmedContent);
      if (parsed) {
        result.rawParamNames.push(parsed.name);
        result.params.push(parsed);
      }
      // Add to generic tags with structured fields for drift detection
      result.tags.push({
        name: 'param',
        text: trimmedContent,
        paramName: parsed?.name,
        typeAnnotation: parsed?.type,
      });
      break;
    }

    case 'returns':
    case 'return': {
      const parsed = parseReturnContent(trimmedContent);
      result.returns = parsed;
      result.tags.push({
        name: 'returns',
        text: trimmedContent,
        typeAnnotation: parsed.type,
      });
      break;
    }

    case 'throws':
    case 'throw':
    case 'exception': {
      const parsed = parseThrowsContent(trimmedContent);
      result.throws.push(parsed);
      result.tags.push({
        name: 'throws',
        text: trimmedContent,
        typeAnnotation: parsed.type,
      });
      break;
    }

    case 'example': {
      const example = processInlineLinks(trimmedContent);
      if (example) {
        result.examples.push(example);
      }
      // Parse structured example with title, description, language
      const structuredExample = parseExampleContent(trimmedContent);
      if (structuredExample) {
        result.structuredExamples.push(structuredExample);
      }
      result.tags.push({
        name: 'example',
        text: example,
        language: structuredExample?.language,
      });
      break;
    }

    case 'see': {
      // Handle @see tags, extracting any link targets
      const linkTargets = extractAllLinkTargets(trimmedContent);
      for (const target of linkTargets) {
        result.seeAlso.push(target);
        result.tags.push({ name: 'link', text: target, reference: target });
        result.tags.push({ name: 'see', text: target, reference: target });
      }
      if (linkTargets.length === 0) {
        // Plain text @see without {@link} - treat as reference
        const plainRef = trimmedContent.trim().split(/\s+/)[0];
        if (plainRef) {
          result.seeAlso.push(plainRef);
        }
        result.tags.push({ name: 'see', text: trimmedContent, reference: plainRef || trimmedContent });
      }
      break;
    }

    case 'link': {
      const target = extractLinkTarget(trimmedContent);
      if (target) {
        result.tags.push({ name: 'link', text: target, reference: target });
      }
      break;
    }

    case 'since': {
      // @since version - extract version string
      result.tags.push({ name: 'since', text: trimmedContent, version: trimmedContent });
      break;
    }

    case 'deprecated': {
      // @deprecated [version] [reason] - extract version and reason
      const versionMatch = trimmedContent.match(/^(\d+\.\d+(?:\.\d+)?)\s*(.*)?$/);
      if (versionMatch) {
        result.tags.push({
          name: 'deprecated',
          text: trimmedContent,
          version: versionMatch[1],
          reason: versionMatch[2]?.trim() || undefined,
        });
      } else {
        result.tags.push({
          name: 'deprecated',
          text: trimmedContent,
          reason: trimmedContent || undefined,
        });
      }
      break;
    }

    case 'type':
    case 'typedef': {
      // @type {TypeName} - extract type annotation
      let typeAnnotation: string | undefined;
      if (trimmedContent.startsWith('{')) {
        const typeEnd = findMatchingBrace(trimmedContent, 0);
        if (typeEnd > 0) {
          typeAnnotation = trimmedContent.slice(1, typeEnd).trim();
        }
      }
      result.tags.push({
        name: tag,
        text: trimmedContent,
        typeAnnotation,
      });
      break;
    }

    case 'inheritdoc': {
      result.tags.push({ name: 'inheritDoc', text: trimmedContent });
      break;
    }

    default: {
      const text = processInlineLinks(trimmedContent);
      if (text || tag) {
        result.tags.push({ name: tag, text });
      }
      break;
    }
  }
}

/**
 * Extract all link targets from text containing {@link ...} patterns.
 */
function extractAllLinkTargets(text: string): string[] {
  const targets: string[] = [];
  const linkRegex = /\{@link\s+([^}]+)\}/g;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const target = extractLinkTarget(match[1]);
    if (target) {
      targets.push(target);
    }
  }

  return targets;
}

/**
 * Extract the target from a link body (without the {@link } wrapper).
 */
function extractLinkTarget(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  // Handle pipe notation: target|label
  const pipeIndex = trimmed.indexOf('|');
  if (pipeIndex >= 0) {
    return trimmed.slice(0, pipeIndex).trim();
  }

  // Handle space notation: target label
  const parts = trimmed.split(/\s+/);
  return parts[0] ?? '';
}

// ============================================================================
// TypeScript AST-based JSDoc extraction
// ============================================================================

/**
 * Extract JSDoc from a TypeScript symbol using the compiler's JSDoc API.
 */
export function extractJSDocFromSymbol(
  symbol: TS.Symbol,
  checker: TS.TypeChecker,
): ParsedJSDocInfo | null {
  const node = symbol.valueDeclaration || symbol.declarations?.[0];
  if (!node) return null;

  const sourceFile = node.getSourceFile();

  // Get JSDoc comments from the node
  const jsDocComments = findJSDocComments(node, sourceFile);
  if (!jsDocComments) return null;

  return parseJSDocBlock(jsDocComments);
}

/**
 * Find JSDoc comment text for a node.
 */
function findJSDocComments(node: TS.Node, sourceFile: TS.SourceFile): string | null {
  // Try to find JSDoc on the node itself
  let commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
  let jsdocRange = findLastJSDocRange(commentRanges, sourceFile.text);

  // For variable declarations, JSDoc is often on the parent VariableStatement
  if (!jsdocRange && ts.isVariableDeclaration(node) && node.parent?.parent) {
    const statement = node.parent.parent;
    if (ts.isVariableStatement(statement)) {
      commentRanges = ts.getLeadingCommentRanges(sourceFile.text, statement.pos);
      jsdocRange = findLastJSDocRange(commentRanges, sourceFile.text);
    }
  }

  if (!jsdocRange) return null;

  return sourceFile.text.substring(jsdocRange.pos, jsdocRange.end);
}

/**
 * Find the last JSDoc comment (starts with slash-star-star) in a list of comment ranges.
 */
function findLastJSDocRange(
  ranges: readonly TS.CommentRange[] | undefined,
  sourceText: string,
): TS.CommentRange | undefined {
  if (!ranges || ranges.length === 0) return undefined;

  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    const text = sourceText.substring(range.pos, range.end);
    if (text.startsWith('/**')) {
      return range;
    }
  }

  return undefined;
}

