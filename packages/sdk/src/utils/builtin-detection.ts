/**
 * Centralized built-in type detection using TypeChecker.
 *
 * Instead of maintaining hardcoded lists, this module determines if a type
 * is built-in by checking if its declaration comes from TypeScript's
 * default library files (lib.*.d.ts).
 */

import type * as TS from 'typescript';
import { ts } from '../ts-module';

/**
 * Check if a symbol is a built-in (from lib.*.d.ts or global scope).
 *
 * @param symbol - The TypeScript symbol to check
 * @param checker - The TypeChecker instance
 * @returns true if the symbol is from a built-in library
 */
export function isBuiltInSymbol(symbol: TS.Symbol | undefined, checker: TS.TypeChecker): boolean {
  if (!symbol) return false;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    // Symbols without declarations are often primitives or intrinsics
    return true;
  }

  for (const declaration of declarations) {
    const sourceFile = declaration.getSourceFile();
    if (sourceFile && isLibraryFile(sourceFile.fileName)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a type is built-in by examining its symbol's declaration source.
 *
 * @param type - The TypeScript type to check
 * @param checker - The TypeChecker instance
 * @returns true if the type is from a built-in library
 */
export function isBuiltInType(type: TS.Type, checker: TS.TypeChecker): boolean {
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  return isBuiltInSymbol(symbol, checker);
}

/**
 * Check if a type name represents a built-in type.
 * This is a fallback for when we only have the name string.
 *
 * Uses a combination of:
 * 1. Single uppercase letter (type parameters like T, K, V)
 * 2. Hardcoded primitives and common built-ins
 * 3. Common library internal patterns
 *
 * @param name - The type name string
 * @returns true if the name is a known built-in
 */
export function isBuiltInTypeName(name: string): boolean {
  // Skip generic type parameters (single uppercase letters like T, K, V)
  if (name.length === 1 && /^[A-Z]$/.test(name)) {
    return true;
  }

  // Skip anonymous types
  if (name.startsWith('__')) {
    return true;
  }

  return BUILTIN_TYPE_NAMES.has(name) || LIBRARY_INTERNAL_PATTERNS.some((re) => re.test(name));
}

/**
 * Check if an identifier represents a built-in global.
 * Used for checking references in example code blocks.
 *
 * @param identifier - The identifier name
 * @returns true if it's a known built-in global
 */
export function isBuiltInIdentifier(identifier: string): boolean {
  return BUILTIN_GLOBALS.has(identifier);
}

/**
 * Check if a file path is a TypeScript library file.
 */
function isLibraryFile(fileName: string): boolean {
  // Normalize path separators
  const normalized = fileName.replace(/\\/g, '/');

  // Check for lib.*.d.ts pattern (TypeScript default libs)
  if (/\/lib\.[^/]+\.d\.ts$/.test(normalized)) {
    return true;
  }

  // Check for node_modules/@types (DefinitelyTyped)
  if (normalized.includes('/node_modules/@types/')) {
    return true;
  }

  // Check for node_modules/typescript/lib
  if (normalized.includes('/node_modules/typescript/lib/')) {
    return true;
  }

  return false;
}

/**
 * Built-in type names that don't require TypeChecker lookup.
 * These are primitives and common built-in constructors/utilities.
 */
const BUILTIN_TYPE_NAMES = new Set([
  // Primitives
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'undefined',
  'null',
  'true',
  'false',

  // Special types
  'any',
  'unknown',
  'never',
  'void',
  'object',

  // Built-in constructors
  'Array',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'Date',
  'RegExp',
  'Error',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'EvalError',
  'URIError',
  'AggregateError',
  'Function',
  'Object',
  'String',
  'Number',
  'Boolean',
  'BigInt',
  'Symbol',

  // Typed arrays
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Uint8ClampedArray',

  // Array buffer related
  'ArrayBuffer',
  'ArrayBufferLike',
  'SharedArrayBuffer',
  'DataView',
  'Atomics',

  // Iterators
  'Iterator',
  'AsyncIterator',
  'IterableIterator',
  'AsyncIterableIterator',
  'Generator',
  'AsyncGenerator',

  // Other built-ins
  'JSON',
  'Math',
  'Reflect',
  'Proxy',
  'Intl',
  'globalThis',
  'FinalizationRegistry',

  // Web APIs (commonly used)
  'URL',
  'URLSearchParams',
  'Headers',
  'Request',
  'Response',
  'Blob',
  'File',
  'FormData',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'AbortController',
  'AbortSignal',
  'TextEncoder',
  'TextDecoder',
  'EventTarget',
  'Event',
  'CustomEvent',

  // DOM types (commonly referenced)
  'Element',
  'Document',
  'Window',
  'Node',
  'HTMLElement',
  'Console',

  // Node.js built-ins
  'Buffer',
  'EventEmitter',

  // TypeScript utility types
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'ReadonlyArray',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'ReturnType',
  'Parameters',
  'InstanceType',
  'ConstructorParameters',
  'Awaited',
  'ThisType',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
  'NoInfer',
  'ThisParameterType',
  'OmitThisParameter',

  // Internal types
  '__type',
]);

/**
 * Built-in globals that can appear in example code.
 * Superset of type names, includes runtime-only globals.
 */
const BUILTIN_GLOBALS = new Set([
  ...BUILTIN_TYPE_NAMES,

  // Runtime globals not in type names
  'console',
  'process',
  'global',
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'fetch',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
  'structuredClone',
  'atob',
  'btoa',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'eval',

  // Common testing globals
  'describe',
  'it',
  'test',
  'expect',
  'jest',
  'vi',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',

  // Module globals
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'import',
]);

/**
 * Patterns for library internal types that should be treated as built-in.
 * These are type names from popular libraries that pollute the type namespace.
 */
const LIBRARY_INTERNAL_PATTERNS: RegExp[] = [
  // TypeBox schema types (TObject, TString, TUnion, etc.)
  /^T[A-Z][a-zA-Z]*$/,
  // Zod types
  /^Zod[A-Z][a-zA-Z]*$/,
  // TypeBox internals
  /^(Union|Intersect|Object|Array)Static$/,
  /^Static(Decode|Encode)$/,
];

