import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  EntryPointDetectionMethod,
  GenerationIssue,
  SpecGenerationInfo,
} from '@openpkg-ts/spec';
import type * as TS from 'typescript';
import type { SchemaExtractionMode } from '../config';
import {
  extractStandardSchemasFromProject,
  type StandardSchemaExtractionResult,
} from '../extract/schema';
import { ts } from '../ts-module';
import { isBuiltInType } from '../utils/type-utils';
import type { AnalysisContextInput, DetectedSchemaEntry } from './context';
import { createAnalysisContext } from './context';
import { buildOpenPkgSpec } from './spec-builder';
import type { OpenPkgSpec } from './spec-types';

export interface AnalysisMetadataInternal {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
  /** Source files included in analysis (for caching) */
  sourceFiles: string[];
}

export interface SpecDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * Input for generation metadata that comes from the caller (CLI, API, etc.)
 */
export interface GenerationInput {
  /** Entry point file path (relative to package root) */
  entryPoint: string;
  /** How the entry point was detected */
  entryPointSource: EntryPointDetectionMethod;
  /** Whether this is a declaration-only analysis (.d.ts file) */
  isDeclarationOnly?: boolean;
  /** Generator tool name */
  generatorName: string;
  /** Generator tool version */
  generatorVersion: string;
  /** Detected package manager */
  packageManager?: string;
  /** Whether this is a monorepo */
  isMonorepo?: boolean;
  /** Target package name (for monorepos) */
  targetPackage?: string;
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

/**
 * Check if external modules can be resolved via the TypeScript program.
 * This works with pnpm, Yarn PnP, and other non-standard module layouts.
 *
 * @param program - The TypeScript program
 * @param baseDir - The base directory of the project
 * @returns true if external modules appear to be resolvable
 */
function canResolveExternalModules(program: TS.Program, baseDir: string): boolean {
  const sourceFiles = program.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    // Skip files outside the project
    if (!sourceFile.fileName.startsWith(baseDir)) continue;

    // Check if any external imports were successfully resolved
    const resolvedModules = (sourceFile as { resolvedModules?: Map<string, unknown> })
      .resolvedModules;
    if (resolvedModules) {
      for (const [moduleName, resolution] of resolvedModules.entries()) {
        // External module (not relative)
        if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
          // If any external module resolved successfully, we have module resolution working
          if (resolution) {
            return true;
          }
        }
      }
    }
  }

  // Fallback: check for node_modules directory (for legacy compatibility)
  return hasNodeModulesDirectoryFallback(baseDir);
}

/**
 * Fallback check for node_modules directory.
 * Only used when TypeScript module resolution can't determine availability.
 */
function hasNodeModulesDirectoryFallback(startDir: string): boolean {
  let current = startDir;
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
  return Array.from(referencedTypes).filter((ref) => !definedTypes.has(ref) && !isBuiltInType(ref));
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

export function runAnalysis(
  input: AnalysisContextInput,
  generationInput?: GenerationInput,
): RunAnalysisResult {
  const context = createAnalysisContext(input);
  const { baseDir, options, program } = context;

  const packageJsonPath = findNearestPackageJson(baseDir);

  // Use TypeScript's module resolution to detect if external modules are available
  // This works with pnpm, Yarn PnP, and other non-standard layouts
  const hasNodeModules = canResolveExternalModules(program, baseDir);
  const resolveExternalTypes =
    options.resolveExternalTypes !== undefined ? options.resolveExternalTypes : hasNodeModules;

  // Filter benign TS5053 (allowJs with isolatedDeclarations/declaration)
  const diagnostics = ts.getPreEmitDiagnostics(context.program).filter((d) => {
    if (d.code === 5053) return false;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    return !/allowJs/i.test(msg);
  });

  // Collect spec-level diagnostics and generation issues
  const specDiagnostics: SpecDiagnostic[] = [];
  const generationIssues: GenerationIssue[] = [];

  // Check if external imports exist but no node_modules found
  if (!hasNodeModules && hasExternalImports(context.sourceFile)) {
    const issue = {
      code: 'NO_NODE_MODULES',
      message: 'External imports detected but node_modules not found.',
      severity: 'info' as const,
      suggestion: 'Run npm install or bun install for complete type resolution.',
    };
    specDiagnostics.push(issue);
    generationIssues.push(issue);
  }

  // Build generation info if provided
  const generation: SpecGenerationInfo | undefined = generationInput
    ? {
        timestamp: new Date().toISOString(),
        generator: {
          name: generationInput.generatorName,
          version: generationInput.generatorVersion,
        },
        analysis: {
          entryPoint: generationInput.entryPoint,
          entryPointSource: generationInput.entryPointSource,
          isDeclarationOnly: generationInput.isDeclarationOnly ?? false,
          resolvedExternalTypes: resolveExternalTypes,
          maxTypeDepth: options.maxDepth,
        },
        environment: {
          packageManager: generationInput.packageManager,
          hasNodeModules,
          isMonorepo: generationInput.isMonorepo,
          targetPackage: generationInput.targetPackage,
        },
        issues: generationIssues,
      }
    : undefined;

  const spec = buildOpenPkgSpec(context, resolveExternalTypes, generation);

  // Track schema extraction metadata if Standard Schemas were detected
  if (input.detectedSchemas && input.detectedSchemas.size > 0 && generation) {
    const vendors = new Set<string>();
    for (const entry of input.detectedSchemas.values()) {
      vendors.add(entry.vendor);
    }
    generation.analysis.schemaExtraction = {
      method: 'hybrid',
      runtimeCount: input.detectedSchemas.size,
      vendors: Array.from(vendors),
    };
  }

  // Check for dangling $refs (refs to types that don't exist at all)
  const danglingRefs = collectDanglingRefs(spec);
  for (const ref of danglingRefs) {
    const issue = {
      code: 'DANGLING_REF',
      message: `Type '${ref}' is referenced but not defined in types[].`,
      severity: 'warning' as const,
      suggestion: hasNodeModules
        ? 'The type may be from an external package. Check import paths.'
        : 'Run npm/bun install to resolve external types.',
    };
    specDiagnostics.push(issue);
    if (generation) {
      generation.issues.push(issue);
    }
  }

  // Check for external type stubs (types that couldn't be resolved)
  const externalTypes = collectExternalTypes(spec);
  if (externalTypes.length > 0) {
    const issue = {
      code: 'EXTERNAL_TYPE_STUBS',
      message: `${externalTypes.length} external type(s) could not be fully resolved: ${externalTypes.slice(0, 5).join(', ')}${externalTypes.length > 5 ? '...' : ''}`,
      severity: 'warning' as const,
      suggestion: hasNodeModules
        ? 'Types are from external packages. Full resolution requires type declarations.'
        : 'Run npm/bun install to resolve external type definitions.',
    };
    specDiagnostics.push(issue);
    if (generation) {
      generation.issues.push(issue);
    }
  }

  // Collect source files from the program (for caching)
  const sourceFiles = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && sf.fileName.startsWith(baseDir))
    .map((sf) => sf.fileName);

  return {
    spec,
    metadata: {
      baseDir,
      configPath: context.configPath,
      packageJsonPath,
      hasNodeModules,
      resolveExternalTypes,
      sourceFiles,
    },
    diagnostics,
    specDiagnostics,
  };
}
