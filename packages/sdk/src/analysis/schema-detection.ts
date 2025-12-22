/**
 * Runtime Schema Detection
 *
 * Detects Standard Schema compliant exports (Zod v4.2+, ArkType, Valibot)
 * by loading the module at runtime and checking for the ~standard marker.
 */

import * as fs from 'node:fs';
import { tryExtractStandardSchema, type StandardSchemaResult } from '../extraction';

/**
 * Context for schema detection.
 */
export interface SchemaDetectionContext {
  /** Base directory for resolving modules */
  baseDir: string;
  /** Entry file being analyzed */
  entryFile: string;
}

/**
 * Result of runtime schema detection for a module.
 */
export interface SchemaDetectionResult {
  /** Map of export name to detected Standard Schema */
  schemas: Map<string, StandardSchemaResult>;
  /** Errors encountered during detection (non-fatal) */
  errors: string[];
}

/**
 * Cached module entry with mtime for invalidation.
 */
interface CachedModule {
  module: unknown;
  mtime: number;
}

// Module cache with mtime-based invalidation
const moduleCache = new Map<string, CachedModule>();

/**
 * Get file mtime in milliseconds, or 0 if file doesn't exist.
 */
function getFileMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Load a module with CJS/ESM fallback and mtime-based cache invalidation.
 * Tries require() first, falls back to dynamic import() for ESM-only packages.
 */
async function loadModule(modulePath: string): Promise<unknown> {
  const currentMtime = getFileMtime(modulePath);
  const cached = moduleCache.get(modulePath);

  // Return cached if mtime hasn't changed
  if (cached && cached.mtime === currentMtime && currentMtime > 0) {
    return cached.module;
  }

  // Clear Node's require cache for this module to get fresh content
  try {
    // biome-ignore lint/security/noGlobalEval: Required for cache access
    const requireCache = eval('require').cache;
    if (requireCache && requireCache[modulePath]) {
      delete requireCache[modulePath];
    }
  } catch {
    // Ignore cache clearing errors
  }

  let mod: unknown;
  try {
    // Try CJS first (faster, synchronous when possible)
    // biome-ignore lint/security/noGlobalEval: Required for CJS module loading
    mod = eval('require')(modulePath);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    // If require fails with ERR_REQUIRE_ESM, try dynamic import
    if (nodeErr.code === 'ERR_REQUIRE_ESM') {
      // For ESM, append timestamp to bust import cache
      const cacheBuster = currentMtime > 0 ? `?t=${currentMtime}` : '';
      mod = await import(`${modulePath}${cacheBuster}`);
    } else {
      throw err;
    }
  }

  moduleCache.set(modulePath, { module: mod, mtime: currentMtime });
  return mod;
}

/**
 * Detect Standard Schema exports from a compiled module.
 *
 * This function attempts to load the compiled/transpiled version of the entry file
 * and checks each export for Standard Schema compliance.
 *
 * @param context - Detection context with paths
 * @returns Detection result with found schemas and any errors
 *
 * @example
 * ```typescript
 * const result = await detectRuntimeSchemas({
 *   baseDir: '/path/to/project',
 *   entryFile: '/path/to/project/dist/index.js',
 * });
 *
 * for (const [name, schema] of result.schemas) {
 *   console.log(`Found ${schema.vendor} schema: ${name}`);
 * }
 * ```
 */
export async function detectRuntimeSchemas(
  context: SchemaDetectionContext,
): Promise<SchemaDetectionResult> {
  const result: SchemaDetectionResult = {
    schemas: new Map(),
    errors: [],
  };

  try {
    // Resolve module path - prefer compiled JS over TS
    const modulePath = resolveModulePath(context.entryFile, context.baseDir);
    if (!modulePath) {
      result.errors.push('Could not resolve compiled module path');
      return result;
    }

    // Load the module
    const mod = await loadModule(modulePath);
    if (!mod || typeof mod !== 'object') {
      result.errors.push('Module did not export an object');
      return result;
    }

    // Check each export for Standard Schema
    const exports = mod as Record<string, unknown>;
    for (const [name, value] of Object.entries(exports)) {
      // Skip internal properties
      if (name.startsWith('_') || name === 'default') {
        continue;
      }

      const schemaResult = tryExtractStandardSchema(value);
      if (schemaResult) {
        result.schemas.set(name, schemaResult);
      }
    }

    // Also check default export if present
    if ('default' in exports && exports.default && typeof exports.default === 'object') {
      const defaultExports = exports.default as Record<string, unknown>;
      for (const [name, value] of Object.entries(defaultExports)) {
        if (name.startsWith('_')) continue;

        const schemaResult = tryExtractStandardSchema(value);
        if (schemaResult && !result.schemas.has(name)) {
          result.schemas.set(name, schemaResult);
        }
      }
    }
  } catch (err) {
    // Non-fatal - fall back to AST-based analysis
    result.errors.push(
      `Runtime detection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}

/**
 * Resolve the compiled module path from a TypeScript source file.
 * Attempts to find the corresponding .js file in common output directories.
 */
function resolveModulePath(entryFile: string, baseDir: string): string | null {
  // If already a .js file, use directly
  if (entryFile.endsWith('.js') || entryFile.endsWith('.mjs') || entryFile.endsWith('.cjs')) {
    return entryFile;
  }

  // Try common patterns for compiled output
  const tsFile = entryFile;
  const possiblePaths = [
    // Same directory, just different extension
    tsFile.replace(/\.tsx?$/, '.js'),
    tsFile.replace(/\.tsx?$/, '.mjs'),
    // dist/ directory
    tsFile.replace(/\/src\//, '/dist/').replace(/\.tsx?$/, '.js'),
    // build/ directory
    tsFile.replace(/\/src\//, '/build/').replace(/\.tsx?$/, '.js'),
    // lib/ directory
    tsFile.replace(/\/src\//, '/lib/').replace(/\.tsx?$/, '.js'),
  ];

  // Try to resolve each path
  for (const testPath of possiblePaths) {
    try {
      // Use require.resolve to check if file exists and is loadable
      require.resolve(testPath, { paths: [baseDir] });
      return testPath;
    } catch {
      // Path not found, try next
    }
  }

  return null;
}

/**
 * Clear the module cache.
 * Useful for testing or when modules may have changed.
 */
export function clearSchemaCache(): void {
  moduleCache.clear();
}
