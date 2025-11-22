import type { ParsedJSDoc } from '../../utils/tsdoc-utils';

export interface PresentationMetadata {
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
}

export function extractPresentationMetadata(doc?: ParsedJSDoc | null): PresentationMetadata {
  if (!doc?.tags || doc.tags.length === 0) {
    return {};
  }

  const findTag = (...names: string[]): string | undefined => {
    for (const name of names) {
      const match = doc.tags?.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      const text = match?.text.trim();
      if (text) {
        return text;
      }
    }
    return undefined;
  };

  return {
    slug: findTag('slug'),
    displayName: findTag('displayname', 'display-name', 'title'),
    category: findTag('category', 'group', 'module'),
    importPath: findTag('importpath', 'import-path', 'import'),
  };
}
