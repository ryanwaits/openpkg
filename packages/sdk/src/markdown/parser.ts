/**
 * Markdown/MDX parser for extracting code blocks
 *
 * Uses unified/remark ecosystem for AST parsing
 */

import type { Code, Root } from 'mdast';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { ExportReference, MarkdownCodeBlock, MarkdownDocFile } from './types';

/**
 * Languages that can be executed
 */
const EXECUTABLE_LANGS = new Set([
  'ts',
  'typescript',
  'js',
  'javascript',
  'tsx',
  'jsx',
]);

/**
 * Check if a language tag represents executable code
 */
export function isExecutableLang(lang: string | null | undefined): boolean {
  if (!lang) return false;
  return EXECUTABLE_LANGS.has(lang.toLowerCase());
}

/**
 * Parse a markdown file and extract code blocks
 */
export function parseMarkdownFile(content: string, filePath: string): MarkdownDocFile {
  const processor = unified().use(remarkParse).use(remarkMdx);
  const tree = processor.parse(content) as Root;
  const codeBlocks: MarkdownCodeBlock[] = [];

  visit(tree, 'code', (node: Code) => {
    if (isExecutableLang(node.lang)) {
      codeBlocks.push({
        lang: node.lang ?? 'ts',
        code: node.value,
        meta: node.meta ?? undefined,
        lineStart: node.position?.start.line ?? 0,
        lineEnd: node.position?.end.line ?? 0,
      });
    }
  });

  return { path: filePath, codeBlocks };
}

/**
 * Parse multiple markdown files
 */
export function parseMarkdownFiles(
  files: Array<{ path: string; content: string }>,
): MarkdownDocFile[] {
  return files.map((f) => parseMarkdownFile(f.content, f.path));
}

/**
 * Extract import statements from code
 * Finds named imports: import { X, Y } from 'pkg'
 */
export function extractImports(code: string): Array<{ name: string; from: string }> {
  const imports: Array<{ name: string; from: string }> = [];
  // Match: import { X, Y, Z } from 'pkg' or "pkg"
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(code)) !== null) {
    const names = match[1];
    const from = match[2];
    // Split by comma and clean up
    const namedImports = names.split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    for (const name of namedImports) {
      if (name) {
        imports.push({ name, from });
      }
    }
  }

  return imports;
}

/**
 * Extract function calls from code
 * Finds: functionName( or functionName<
 */
export function extractFunctionCalls(code: string): string[] {
  const calls = new Set<string>();
  // Match identifier followed by ( or <
  // Exclude common keywords
  const callRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[(<]/g;
  const keywords = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'function',
    'class',
    'interface',
    'type',
    'import',
    'export',
    'return',
    'throw',
    'new',
    'typeof',
    'instanceof',
  ]);

  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(code)) !== null) {
    const name = match[1];
    if (!keywords.has(name)) {
      calls.add(name);
    }
  }

  return Array.from(calls);
}

/**
 * Find all references to given export names in markdown files
 */
export function findExportReferences(
  files: MarkdownDocFile[],
  exportNames: string[],
): ExportReference[] {
  const references: ExportReference[] = [];
  const exportSet = new Set(exportNames);

  for (const file of files) {
    // Search in code blocks
    for (let blockIndex = 0; blockIndex < file.codeBlocks.length; blockIndex++) {
      const block = file.codeBlocks[blockIndex];

      // Check imports
      const imports = extractImports(block.code);
      for (const imp of imports) {
        if (exportSet.has(imp.name)) {
          references.push({
            exportName: imp.name,
            file: file.path,
            line: block.lineStart,
            context: getContextFromCode(block.code, imp.name),
            inCodeBlock: true,
            blockIndex,
          });
        }
      }

      // Check function calls
      const calls = extractFunctionCalls(block.code);
      for (const call of calls) {
        if (exportSet.has(call)) {
          // Avoid duplicates if already found via import
          const alreadyFound = references.some(
            (r) =>
              r.exportName === call && r.file === file.path && r.blockIndex === blockIndex,
          );
          if (!alreadyFound) {
            references.push({
              exportName: call,
              file: file.path,
              line: block.lineStart,
              context: getContextFromCode(block.code, call),
              inCodeBlock: true,
              blockIndex,
            });
          }
        }
      }
    }
  }

  return references;
}

/**
 * Get context around a reference in code
 */
function getContextFromCode(code: string, name: string): string {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(name)) {
      // Return the line and one line before/after
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);
      return lines.slice(start, end).join('\n');
    }
  }
  return code.slice(0, 100);
}

/**
 * Check if a code block references any of the given export names
 */
export function blockReferencesExport(block: MarkdownCodeBlock, exportName: string): boolean {
  const imports = extractImports(block.code);
  if (imports.some((i) => i.name === exportName)) {
    return true;
  }
  const calls = extractFunctionCalls(block.code);
  return calls.includes(exportName);
}

