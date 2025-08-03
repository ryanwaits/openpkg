import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as ts from 'typescript';

/**
 * Find the source .ts file for a .d.ts declaration file
 */
export function findSourceFile(dtsPath: string, packageDir: string): string | null {
  // Common mappings from dist to src
  const mappings = [
    { from: '/dist/', to: '/src/' },
    { from: '/lib/', to: '/src/' },
    { from: '/build/', to: '/src/' },
    { from: '/types/', to: '/src/' },
  ];

  // Try direct .ts replacement
  const directTsPath = dtsPath.replace(/\.d\.ts$/, '.ts');
  if (fs.existsSync(directTsPath)) {
    return directTsPath;
  }

  // Try common directory mappings
  for (const mapping of mappings) {
    if (dtsPath.includes(mapping.from)) {
      const srcPath = dtsPath.replace(mapping.from, mapping.to).replace(/\.d\.ts$/, '.ts');

      if (fs.existsSync(srcPath)) {
        return srcPath;
      }
    }
  }

  // Try to find in src directory
  const relativePath = path.relative(packageDir, dtsPath);
  const possiblePaths = [
    path.join(packageDir, 'src', path.basename(dtsPath).replace(/\.d\.ts$/, '.ts')),
    path.join(packageDir, 'src', relativePath.replace(/\.d\.ts$/, '.ts')),
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    }
  }

  return null;
}

/**
 * Get source file content for documentation parsing
 */
export function getSourceFileForDocs(node: ts.Node, packageDir: string): string | null {
  const sourceFile = node.getSourceFile();
  const fileName = sourceFile.fileName;

  // If already a .ts file, return it
  if (!fileName.endsWith('.d.ts')) {
    return fileName;
  }

  // Try to find corresponding source file
  return findSourceFile(fileName, packageDir);
}
