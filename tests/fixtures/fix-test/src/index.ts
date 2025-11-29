/**
 * Adds two numbers together.
 *
 * @param a - First number
 * @returns {number} This says string but returns number
 */
export function add(a: number, second: number): number {
  return a + second;
}

/**
 * Multiply numbers.
 *
 * @param {number} x - Wrong type, should be number
 * @param y - Wrong optionality, y is required
 */
export function multiply(x: number, y: number): number {
  return x * y;
}

/**
 * Divide numbers.
 * @param numerator - The numerator
 */
export function divide(numerator: number, denominator: number): number {
  return numerator / denominator;
}

/**
 * Subtract two numbers.
 *
 * @param a - First number
 * @param b - Second number
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * This function is deprecated in code but not in docs.
 *
 * @param value - The value to process
 * @returns {string} The processed value
 * @deprecated Use newProcess instead
 */
export function oldProcess(value: string): string {
  return value.toUpperCase();
}

/**
 * This function has @deprecated but code is not deprecated.
 *
 * @param value - The value to process
 * @returns {string} The processed value
 * @deprecated This is deprecated
 */
export function notActuallyDeprecated(value: string): string {
  return value.toLowerCase();
}

/**
 * This async function returns Promise but docs don't indicate it.
 *
 * @async
 * @param ms - Milliseconds to wait
 * @returns {Promise<string>} The result after waiting
 */
export async function waitAndReturn(ms: number): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return 'done';
}

/**
 * This function is documented as async but doesn't return Promise.
 *
 * @async
 * @param value - The value
 * @returns {string} The result
 */
export function notActuallyAsync(value: string): string {
  return value;
}

/**
 * A configuration object.
 * @type {string}
 */
export const config: { name: string; enabled: boolean } = {
  name: 'test',
  enabled: true,
};
