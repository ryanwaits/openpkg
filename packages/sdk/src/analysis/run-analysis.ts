import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as TS from 'typescript';
import { ts } from '../ts-module';
import { isBuiltInType } from '../utils/type-utils';
import type { AnalysisContextInput } from './context';
import { createAnalysisContext } from './context';
import { buildOpenPkgSpec } from './spec-builder';
import type { OpenPkgSpec } from './spec-types';

export interface AnalysisMetadataInternal {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
}

export interface SpecDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface RunAnalysisResult {
  spec: OpenPkgSpec;
  metadata: AnalysisMetadataInternal;
  diagnostics: readonly TS.Diagnostic[];
  specDiagnostics: SpecDiagnostic[];
}

function findNearestPackageJson(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function hasNodeModulesDirectory(directories: Iterable<string>): boolean {
  for (const dir of directories) {
    let current = dir;
    while (true) {
      const candidate = path.join(current, 'node_modules');
      if (fs.existsSync(candidate)) {
        return true;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return false;
}

/**
 * Collect all $ref values from a nested object/array structure
 */
function collectAllRefs(obj: unknown, refs: Set<string>): void {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectAllRefs(item, refs);
    }
    return;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (typeof record.$ref === 'string' && record.$ref.startsWith('#/types/')) {
      refs.add(record.$ref.slice('#/types/'.length));
    }
    for (const value of Object.values(record)) {
      collectAllRefs(value, refs);
    }
  }
}

/**
 * Find all dangling $ref references in the spec (refs to types not defined in types[])
 */
function collectDanglingRefs(spec: OpenPkgSpec): string[] {
  const definedTypes = new Set(spec.types?.map((t) => t.id) ?? []);
  const referencedTypes = new Set<string>();

  // Collect refs from exports
  collectAllRefs(spec.exports, referencedTypes);

  // Collect refs from types (for nested type references)
  collectAllRefs(spec.types, referencedTypes);

  // Filter out built-in and library internal types
  return Array.from(referencedTypes).filter(
    (ref) => !definedTypes.has(ref) && !isBuiltInType(ref),
  );
}

/**
 * Find all external type stubs in the spec (unresolved types)
 */
function collectExternalTypes(spec: OpenPkgSpec): string[] {
  return (spec.types ?? [])
    .filter((t) => t.kind === 'external')
    .map((t) => t.id)
    .filter((id) => !isBuiltInType(id));
}

/**
 * Check if source file has external (non-relative) imports
 */
function hasExternalImports(sourceFile: TS.SourceFile): boolean {
  let found = false;
  ts.forEachChild(sourceFile, (node) => {
    if (found) return;
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const modulePath = specifier.text;
        // External if not starting with . or /
        if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
          found = true;
        }
      }
    }
  });
  return found;
}

export function runAnalysis(input: AnalysisContextInput): RunAnalysisResult {
  const context = createAnalysisContext(input);
  const { baseDir, options } = context;

  const packageJsonPath = findNearestPackageJson(baseDir);
  const searchDirs = new Set<string>([baseDir]);
  if (packageJsonPath) {
    searchDirs.add(path.dirname(packageJsonPath));
  }

  const hasNodeModules = hasNodeModulesDirectory(searchDirs);
  const resolveExternalTypes =
    options.resolveExternalTypes !== undefined ? options.resolveExternalTypes : hasNodeModules;

  // Filter benign TS5053 (allowJs with isolatedDeclarations/declaration)
  const diagnostics = ts.getPreEmitDiagnostics(context.program).filter((d) => {
    if (d.code === 5053) return false;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    return !/allowJs/i.test(msg);
  });

  const spec = buildOpenPkgSpec(context, resolveExternalTypes);

  // Collect spec-level diagnostics
  const specDiagnostics: SpecDiagnostic[] = [];

  // Check if external imports exist but no node_modules found
  if (!hasNodeModules && hasExternalImports(context.sourceFile)) {
    specDiagnostics.push({
      message: 'External imports detected but node_modules not found.',
      severity: 'info',
      suggestion: 'Run npm install or bun install for complete type resolution.',
    });
  }

  // Check for dangling $refs (refs to types that don't exist at all)
  const danglingRefs = collectDanglingRefs(spec);
  for (const ref of danglingRefs) {
    specDiagnostics.push({
      message: `Type '${ref}' is referenced but not defined in types[].`,
      severity: 'warning',
      suggestion: hasNodeModules
        ? 'The type may be from an external package. Check import paths.'
        : 'Run npm/bun install to resolve external types.',
    });
  }

  // Check for external type stubs (types that couldn't be resolved)
  const externalTypes = collectExternalTypes(spec);
  if (externalTypes.length > 0) {
    specDiagnostics.push({
      message: `${externalTypes.length} external type(s) could not be fully resolved: ${externalTypes.slice(0, 5).join(', ')}${externalTypes.length > 5 ? '...' : ''}`,
      severity: 'warning',
      suggestion: hasNodeModules
        ? 'Types are from external packages. Full resolution requires type declarations.'
        : 'Run npm/bun install to resolve external type definitions.',
    });
  }

  return {
    spec,
    metadata: {
      baseDir,
      configPath: context.configPath,
      packageJsonPath,
      hasNodeModules,
      resolveExternalTypes,
    },
    diagnostics,
    specDiagnostics,
  };
}
