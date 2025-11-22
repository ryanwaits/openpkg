/**
 * Adds two numbers together.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns Sum of the operands.
 * @example
 * ```ts
 * documentedAdd(1, 2); // 3
 * ```
 */
export function documentedAdd(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies every number in the list.
 *
 * @param values - Numbers to multiply (intentionally documented, but no example block).
 * @returns Product of all numbers.
 */
export function missingExample(values: number[]): number {
  return values.reduce((product, value) => product * value, 1);
}

/**
 * Builds a greeting for a user.
 *
 * This intentionally lacks @param annotations to demonstrate missing parameter docs.
 * @returns Personalized greeting.
 */
export function missingParamDocs(name: string, title: string): string {
  return `Hello ${title} ${name}`;
}

// No doc comment at all – should be reported as undocumented.
export function undocumentedSubtract(a: number, b: number): number {
  return a - b;
}
