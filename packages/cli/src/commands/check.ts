/**
 * Check command for documentation coverage.
 *
 * This module re-exports from the modular check/ directory for backward compatibility.
 *
 * @module check
 */

export {
  type CheckCommandDependencies,
  type CollectedDrift,
  type OutputFormat,
  registerCheckCommand,
  type StaleReference,
} from './check/index';
