/**
 * Configuration types for DocCov.
 * These types are shared between CLI and API.
 */

/**
 * Documentation configuration options.
 */
export interface DocsConfig {
  /** Glob patterns for markdown docs to include */
  include?: string[];
  /** Glob patterns for markdown docs to exclude */
  exclude?: string[];
}

/**
 * Check command configuration options.
 */
export interface CheckConfig {
  /** Enable lint checks (default: true) */
  lint?: boolean;
  /** Enable typecheck for examples (default: true) */
  typecheck?: boolean;
  /** Enable runtime execution of examples (default: false) */
  exec?: boolean;
}

/**
 * Lint severity level.
 */
export type LintSeverity = 'error' | 'warn' | 'off';

/**
 * Lint rules configuration.
 */
export interface LintRulesConfig {
  /** Rule severity overrides */
  rules?: Record<string, LintSeverity>;
}

/**
 * Normalized DocCov configuration.
 * This is the parsed/normalized form used by commands.
 */
export interface DocCovConfig {
  /** Export include patterns */
  include?: string[];
  /** Export exclude patterns */
  exclude?: string[];
  /** Plugins (future) */
  plugins?: unknown[];
  /** Documentation configuration */
  docs?: DocsConfig;
  /** Check command configuration */
  check?: CheckConfig;
  /** Lint configuration */
  lint?: LintRulesConfig;
}

/**
 * Define a DocCov configuration.
 * Helper function for type-safe configuration in doccov.config.ts.
 *
 * @param config - Configuration object
 * @returns The configuration object (for type inference)
 *
 * @example
 * ```typescript
 * // doccov.config.ts
 * import { defineConfig } from '@doccov/sdk';
 *
 * export default defineConfig({
 *   include: ['MyClass', 'myFunction'],
 *   exclude: ['internal*'],
 *   docs: {
 *     include: ['docs/**\/*.md'],
 *   },
 *   lint: {
 *     rules: {
 *       'require-description': 'error',
 *       'require-example': 'warn',
 *     },
 *   },
 * });
 * ```
 */
export function defineConfig(config: DocCovConfig): DocCovConfig {
  return config;
}

