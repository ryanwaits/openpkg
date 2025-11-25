/**
 * Return type drift: docs say `{string}`, signature returns `number`.
 *
 * @param value - Input value.
 * @returns {string} Should return a string (but actually returns number).
 */
export function calculateTotal(value: number): number {
  return value * 1.1;
}

/**
 * Return type drift with complex type.
 *
 * @returns {Promise<string>} Docs say Promise<string>, but returns Promise<number>.
 */
export async function fetchCount(): Promise<number> {
  return 42;
}

/**
 * Control case: correctly documented return type.
 *
 * @returns {boolean} True if valid.
 */
export function isValid(): boolean {
  return true;
}

