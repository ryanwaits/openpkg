/**
 * Check command for documentation coverage.
 *
 * This module re-exports from the modular check/ directory for backward compatibility.
 *
 * @module check
 */

export {
  registerCheckCommand,
  type CheckCommandDependencies,
  type CollectedDrift,
  type OutputFormat,
  type StaleReference,
} from './check/index';
