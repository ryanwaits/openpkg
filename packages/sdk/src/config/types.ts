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
 * Example validation modes.
 */
export type ExampleValidationMode = 'presence' | 'typecheck' | 'run';

/**
 * Check command configuration options.
 */
export interface CheckConfig {
  /**
   * Example validation modes to run.
   * Can be a single mode, array of modes, or comma-separated string.
   * - 'presence': Check that @example blocks exist on exports
   * - 'typecheck': Compile examples with TypeScript
   * - 'run': Execute examples and validate assertions
   */
  examples?: ExampleValidationMode | ExampleValidationMode[] | string;
  /** Minimum coverage percentage required (0-100) */
  minCoverage?: number;
  /** Maximum drift percentage allowed (0-100) */
  maxDrift?: number;
}

/**
 * Quality rule severity level.
 */
export type QualitySeverity = 'error' | 'warn' | 'off';

/**
 * Quality rules configuration.
 */
export interface QualityRulesConfig {
  /** Rule severity overrides */
  rules?: Record<string, QualitySeverity>;
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
  /** Quality rules configuration */
  quality?: QualityRulesConfig;
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
 *   quality: {
 *     rules: {
 *       'has-description': 'error',
 *       'has-examples': 'warn',
 *     },
 *   },
 * });
 * ```
 */
export function defineConfig(config: DocCovConfig): DocCovConfig {
  return config;
}
