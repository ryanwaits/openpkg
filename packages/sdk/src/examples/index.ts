/**
 * Example validation module.
 *
 * Provides unified example validation including:
 * - Presence: Check that @example blocks exist on exports
 * - Typecheck: Compile examples with TypeScript
 * - Run: Execute examples and validate assertions
 */

// Types and utilities
export {
  ALL_VALIDATIONS,
  type ExampleValidation,
  parseExamplesFlag,
  shouldValidate,
  VALIDATION_INFO,
} from './types';

// Validator
export {
  type ExampleValidationOptions,
  type ExampleValidationResult,
  type ExampleValidationTypeError,
  type LLMAssertion,
  type PresenceResult,
  type RuntimeDrift,
  type RunValidationResult,
  type TypecheckValidationResult,
  validateExamples,
} from './validator';
