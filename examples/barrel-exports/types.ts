// types.ts - Type definitions
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ValidatorFunction<T> = (input: T) => ValidationResult;
