import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  types?: string;
  typings?: string;
  exports?: string | Record<string, unknown>;
  workspaces?: string[] | { packages: string[] };
}

/**
 * Find the entry point for a package by checking package.json fields
 */
export async function findEntryPoint(packageDir: string, preferSource = false): Promise<string> {
  const packageJsonPath = path.join(packageDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    // No package.json, try common entry points
    return findDefaultEntryPoint(packageDir);
  }

  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Priority order for entry point detection:
  // 1. TypeScript declaration files (types/typings field)
  // 2. Exports field (modern packages)
  // 3. Main field with corresponding .d.ts
  // 4. Common defaults

  // If preferSource is true, try to find .ts files first
  if (preferSource) {
    // Look for src/index.ts first
    const srcIndex = path.join(packageDir, 'src/index.ts');
    if (fs.existsSync(srcIndex)) {
      return srcIndex;
    }
  }

  // Check types/typings field first (points to .d.ts files)
  if (!preferSource && (packageJson.types || packageJson.typings)) {
    const typesPath = path.join(packageDir, packageJson.types || packageJson.typings!);
    if (fs.existsSync(typesPath)) {
      return typesPath;
    }
  }

  // Check exports field (modern packages)
  if (packageJson.exports) {
    const exportPath = resolveExportsField(packageJson.exports, packageDir);
    if (exportPath) {
      return exportPath;
    }
  }

  // Check main field
  if (packageJson.main) {
    // First try to find corresponding .d.ts file
    const mainBase = packageJson.main.replace(/\.(js|mjs|cjs)$/, '');
    const dtsPath = path.join(packageDir, `${mainBase}.d.ts`);
    if (fs.existsSync(dtsPath)) {
      return dtsPath;
    }

    // Try to find corresponding .ts source
    const tsPath = path.join(packageDir, `${mainBase}.ts`);
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }

    // Check if main points to a directory with index
    const mainPath = path.join(packageDir, packageJson.main);
    if (fs.existsSync(mainPath) && fs.statSync(mainPath).isDirectory()) {
      const indexDts = path.join(mainPath, 'index.d.ts');
      const indexTs = path.join(mainPath, 'index.ts');
      if (fs.existsSync(indexDts)) return indexDts;
      if (fs.existsSync(indexTs)) return indexTs;
    }
  }

  // Fall back to common defaults
  return findDefaultEntryPoint(packageDir);
}

/**
 * Resolve exports field to find TypeScript entry
 */
function resolveExportsField(
  exports: string | Record<string, unknown>,
  packageDir: string,
): string | null {
  if (typeof exports === 'string') {
    return findTypeScriptFile(path.join(packageDir, exports));
  }

  if (typeof exports === 'object' && exports !== null && '.' in exports) {
    const dotExport = (exports as Record<string, unknown>)['.'];

    if (typeof dotExport === 'string') {
      return findTypeScriptFile(path.join(packageDir, dotExport));
    }

    if (dotExport && typeof dotExport === 'object') {
      const dotRecord = dotExport as Record<string, unknown>;

      // Check for types in conditional exports
      const typesEntry = dotRecord.types;
      if (typeof typesEntry === 'string') {
        const typesPath = path.join(packageDir, typesEntry);
        if (fs.existsSync(typesPath)) {
          return typesPath;
        }
      }

      // Check other conditions
      for (const condition of ['import', 'require', 'default']) {
        const target = dotRecord[condition];
        if (typeof target === 'string') {
          const result = findTypeScriptFile(path.join(packageDir, target));
          if (result) return result;
        }
      }
    }
  }

  return null;
}

/**
 * Find TypeScript file from JavaScript file path
 */
function findTypeScriptFile(jsPath: string): string | null {
  if (!fs.existsSync(jsPath)) return null;

  // Try .d.ts first
  const dtsPath = jsPath.replace(/\.(js|mjs|cjs)$/, '.d.ts');
  if (fs.existsSync(dtsPath)) {
    return dtsPath;
  }

  // Try .ts
  const tsPath = jsPath.replace(/\.(js|mjs|cjs)$/, '.ts');
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  return null;
}

/**
 * Find default entry point when package.json doesn't specify
 */
async function findDefaultEntryPoint(packageDir: string): Promise<string> {
  const candidates = [
    'dist/index.d.ts',
    'dist/index.ts',
    'lib/index.d.ts',
    'lib/index.ts',
    'src/index.ts',
    'index.d.ts',
    'index.ts',
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(packageDir, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`Could not find entry point in ${packageDir}`);
}

/**
 * Find a package in a monorepo by name
 */
export async function findPackageInMonorepo(
  rootDir: string,
  packageName: string,
): Promise<string | null> {
  const rootPackageJsonPath = path.join(rootDir, 'package.json');

  if (!fs.existsSync(rootPackageJsonPath)) {
    return null;
  }

  const rootPackageJson: PackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));

  // Check if root package matches the requested name (for repos like zod where main package is at root)
  if (rootPackageJson.name === packageName) {
    return rootDir;
  }

  // Get workspace patterns from package.json
  let workspacePatterns: string[] = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : rootPackageJson.workspaces?.packages || [];

  // If no workspaces in package.json, check for pnpm-workspace.yaml
  if (workspacePatterns.length === 0) {
    const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspacePath)) {
      const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
      // Simple YAML parsing for packages array
      const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (packagesMatch) {
        workspacePatterns = packagesMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(line => line.length > 0);
      }
    }
  }

  // Search through workspace directories
  for (const pattern of workspacePatterns) {
    const searchPath = path.join(rootDir, pattern.replace('/**', '').replace('/*', ''));

    if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
      // Look for packages in this directory
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packagePath = path.join(searchPath, entry.name);
          const packageJsonPath = path.join(packagePath, 'package.json');

          if (fs.existsSync(packageJsonPath)) {
            const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

            if (packageJson.name === packageName) {
              return packagePath;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Load TypeScript config from a package
 */
export function loadTsConfig(packageDir: string): Record<string, unknown> | null {
  const tsconfigPath = path.join(packageDir, 'tsconfig.json');

  if (!fs.existsSync(tsconfigPath)) {
    return null;
  }

  try {
    // Simple JSON parse for now - in production, would need to handle extends, comments, etc.
    return JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
  } catch (error) {
    console.warn(`Failed to parse tsconfig.json: ${error}`);
    return null;
  }
}
