import ts from 'typescript';
import type { SpecSource, SpecTag } from '@openpkg-ts/spec';

export function getJSDocComment(node: ts.Node): { description?: string; tags: SpecTag[] } {
  const jsDocTags = ts.getJSDocTags(node);
  const tags: SpecTag[] = jsDocTags.map(tag => ({
    name: tag.tagName.text,
    text: typeof tag.comment === 'string' ? tag.comment : ts.getTextOfJSDocComment(tag.comment) ?? '',
  }));

  // Get description from first JSDoc comment
  const jsDocComments = (node as ts.HasJSDoc).jsDoc;
  let description: string | undefined;
  if (jsDocComments && jsDocComments.length > 0) {
    const firstDoc = jsDocComments[0];
    if (firstDoc.comment) {
      description = typeof firstDoc.comment === 'string'
        ? firstDoc.comment
        : ts.getTextOfJSDocComment(firstDoc.comment);
    }
  }

  return { description, tags };
}

export function getSourceLocation(node: ts.Node, sourceFile: ts.SourceFile): SpecSource {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}
