import type { SpecExample, SpecExampleLanguage, SpecSource, SpecTag } from '@openpkg-ts/spec';
import ts from 'typescript';

/**
 * Parse @example tags into SpecExample objects.
 * Handles markdown code fences and extracts language.
 */
function parseExamplesFromTags(tags: SpecTag[]): SpecExample[] {
  const examples: SpecExample[] = [];

  for (const tag of tags) {
    if (tag.name !== 'example') continue;

    const text = tag.text.trim();
    // Match code fence: ```lang\ncode\n``` or ```\ncode\n```
    const fenceMatch = text.match(/^```(\w*)\n([\s\S]*?)\n?```$/);

    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const code = fenceMatch[2].trim();
      const example: SpecExample = { code };
      if (lang && ['ts', 'js', 'tsx', 'jsx', 'shell', 'json'].includes(lang)) {
        example.language = lang as SpecExampleLanguage;
      }
      examples.push(example);
    } else if (text) {
      // No code fence, use raw text
      examples.push({ code: text });
    }
  }

  return examples;
}

export function getJSDocComment(node: ts.Node): {
  description?: string;
  tags: SpecTag[];
  examples: SpecExample[];
} {
  const jsDocTags = ts.getJSDocTags(node);
  const tags: SpecTag[] = jsDocTags.map((tag) => ({
    name: tag.tagName.text,
    text:
      typeof tag.comment === 'string' ? tag.comment : (ts.getTextOfJSDocComment(tag.comment) ?? ''),
  }));

  // Get description from first JSDoc comment
  const jsDocComments = (node as ts.HasJSDoc).jsDoc;
  let description: string | undefined;
  if (jsDocComments && jsDocComments.length > 0) {
    const firstDoc = jsDocComments[0];
    if (firstDoc.comment) {
      description =
        typeof firstDoc.comment === 'string'
          ? firstDoc.comment
          : ts.getTextOfJSDocComment(firstDoc.comment);
    }
  }

  // Parse @example tags into examples array
  const examples = parseExamplesFromTags(tags);

  return { description, tags, examples };
}

export function getSourceLocation(node: ts.Node, sourceFile: ts.SourceFile): SpecSource {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}
