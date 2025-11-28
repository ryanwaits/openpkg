// ============================================
// HAPPY PATH EXAMPLES - Should all pass
// These examples are self-contained and don't reference the exports
// ============================================

/**
 * Adds two numbers together.
 * @param a - First number
 * @param b - Second number
 * @returns {number} The sum of a and b
 * @example
 * ```ts
 * // Import and use the add function from the package
 * import { add } from 'example-runner-fixture';
 * const result = add(2, 3);
 * console.log(result); // 5
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers.
 * @param x - First number
 * @param y - Second number
 * @returns {number} The product of x and y
 * @example
 * ```ts
 * // Import and use the multiply function from the package
 * import { multiply } from 'example-runner-fixture';
 * const product = multiply(4, 5);
 * console.log(product); // 20
 * ```
 */
export function multiply(x: number, y: number): number {
  return x * y;
}

/**
 * Async function that fetches data after a delay.
 * @param delayMs - Delay in milliseconds
 * @returns {Promise<string>} A promise that resolves with a greeting
 * @example
 * ```ts
 * // Async/await example
 * const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
 * await delay(10);
 * console.log("Done after delay");
 * ```
 */
export async function fetchData(delayMs: number): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return `Hello after ${delayMs}ms`;
}

/**
 * A constant representing PI.
 * @example
 * ```ts
 * // Using a constant
 * const pi = 3.14159;
 * console.log(pi);
 * ```
 */
// biome-ignore lint/suspicious/noApproximativeNumericConstant: intentional for testing
export const PI = 3.14159;

/**
 * A simple greeter class.
 * @example
 * ```ts
 * // Class instantiation example
 * class MyGreeter {
 *   private name: string;
 *   constructor(name: string) { this.name = name; }
 *   greet() { return `Hello, ${this.name}!`; }
 * }
 * const g = new MyGreeter("World");
 * console.log(g.greet());
 * ```
 */
export class Greeter {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }

  greet(): string {
    return `Hello, ${this.name}!`;
  }
}

// ============================================
// SAD PATH EXAMPLES - Should all fail
// ============================================

/**
 * Function with example that throws ReferenceError.
 * @param value - Input value
 * @returns Processed value
 * @example
 * ```ts
 * // This example references an undefined variable
 * const result = processWithError(undefinedVariable);
 * console.log(result);
 * ```
 */
export function processWithError(value: unknown): unknown {
  return value;
}

/**
 * Function with example that throws TypeError.
 * @param obj - Input object
 * @returns Property value
 * @example
 * ```ts
 * // This example tries to access property of null
 * const obj = null;
 * const result = getProperty(obj.foo);
 * console.log(result);
 * ```
 */
export function getProperty(obj: unknown): unknown {
  return obj;
}

/**
 * Function with example that has infinite loop (will timeout).
 * @param n - Starting number
 * @returns Final value
 * @example
 * ```ts
 * // This example will timeout due to infinite loop
 * let x = 0;
 * while (true) { x++; }
 * const result = infiniteExample(x);
 * console.log(result);
 * ```
 */
export function infiniteExample(n: number): number {
  return n;
}

/**
 * Function with example that imports non-existent module.
 * @param input - Input string
 * @returns Transformed string
 * @example
 * ```ts
 * // This example tries to import a non-existent module
 * import { transform } from 'non-existent-module-xyz';
 * const result = badImport(transform('test'));
 * console.log(result);
 * ```
 */
export function badImport(input: string): string {
  return input.toUpperCase();
}

/**
 * Function with example that throws a custom error.
 * @param shouldFail - Whether to fail
 * @returns Success message
 * @example
 * ```ts
 * // This example throws an error
 * throw new Error("Intentional test failure");
 * const result = throwsError(false);
 * console.log(result);
 * ```
 */
export function throwsError(shouldFail: boolean): string {
  if (shouldFail) {
    throw new Error('Failed!');
  }
  return 'Success';
}

/**
 * Function with example that has async rejection.
 * @returns Promise that rejects
 * @example
 * ```ts
 * // This example has an unhandled promise rejection
 * const promise = Promise.reject(new Error("Async failure"));
 * await promise;
 * console.log(asyncReject());
 * ```
 */
export async function asyncReject(): Promise<string> {
  return 'Never reached';
}
