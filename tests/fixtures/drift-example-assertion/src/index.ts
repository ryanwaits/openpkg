/**
 * Add two numbers.
 * @param a - First number
 * @param b - Second number
 * @returns {number} The sum
 * @example
 * ```ts
 * import { add } from 'drift-example-assertion';
 * console.log(add(1, 2)); // => 3
 * console.log(add(0, 0)); // => 0
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiply two numbers - INTENTIONALLY WRONG ASSERTION for testing.
 * @param a - First number
 * @param b - Second number
 * @returns {number} The product
 * @example
 * ```ts
 * import { multiply } from 'drift-example-assertion';
 * console.log(multiply(2, 3)); // => 5
 * ```
 */
export function multiply(a: number, b: number): number {
  return a * b; // Returns 6, but assertion expects 5
}

/**
 * Subtract two numbers - no assertions, should pass.
 * @param a - First number
 * @param b - Second number
 * @returns {number} The difference
 * @example
 * ```ts
 * import { subtract } from 'drift-example-assertion';
 * const result = subtract(5, 3);
 * console.log(result);
 * ```
 */
export function subtract(a: number, b: number): number {
  return a - b;
}
