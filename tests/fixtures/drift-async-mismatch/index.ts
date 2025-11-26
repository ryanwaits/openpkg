/**
 * Async function without Promise documentation.
 * The function returns Promise but docs don't indicate async behavior.
 *
 * @returns The fetched data as a string
 */
export async function fetchData(): Promise<string> {
  return 'data';
}

/**
 * Sync function incorrectly documented as async.
 *
 * @async
 * @returns The computed value
 */
export function computeValue(): number {
  return 42;
}

/**
 * Sync function with incorrect Promise return type in docs.
 *
 * @returns {Promise<string>} The greeting message
 */
export function getGreeting(): string {
  return 'Hello';
}

/**
 * Control case: properly documented async function.
 *
 * @async
 * @returns {Promise<number>} The result of the async operation
 */
export async function processAsync(): Promise<number> {
  return 100;
}

/**
 * Control case: properly documented sync function.
 *
 * @returns {string} The formatted output
 */
export function formatOutput(): string {
  return 'output';
}
