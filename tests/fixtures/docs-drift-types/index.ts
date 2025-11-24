/**
 * Adds a fee to the base amount.
 *
 * @param {string} amount - Intentionally documented as a string (should be number).
 * @param {number} fee - Correctly documented parameter for comparison.
 * @returns Total with fee included.
 */
export function addFee(amount: number, fee: number): number {
  return amount + fee;
}

/**
 * Multiplies a value by a multiplier.
 *
 * @param {number} value - Properly documented parameter.
 * @param {number} multiplier - Another properly documented parameter.
 * @returns Product of the inputs.
 */
export function multiply(value: number, multiplier: number): number {
  return value * multiplier;
}
