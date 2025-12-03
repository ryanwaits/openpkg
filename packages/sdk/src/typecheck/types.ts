export interface ExampleTypeError {
  /** Index of the example in the examples array */
  exampleIndex: number;
  /** Line number within the example (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Error message from TypeScript */
  message: string;
  /** TypeScript diagnostic code */
  code: number;
}

export interface TypecheckResult {
  /** All type errors found across examples */
  errors: ExampleTypeError[];
  /** Number of examples that passed */
  passed: number;
  /** Number of examples that failed */
  failed: number;
}

export interface TypecheckOptions {
  /** Path to tsconfig.json (auto-detected if not provided) */
  tsconfig?: string;
  /** Package name for imports (auto-detected from package.json if not provided) */
  packageName?: string;
}

