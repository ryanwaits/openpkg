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

/**
 * Multiplies two numbers together.
 *
 * This intentionally returns a different type than the signature.
 * @returns {string} Product of the operands.
 */
export function returnTypeDrift(a: number, b: number): number {
  return a * b;
}

/**
 * Returns a promise.
 *
 * @returns {string} The result (drift: missing Promise wrapper).
 */
export function promiseDrift(): Promise<string> {
  return Promise.resolve('value');
}

/**
 * Returns a raw value.
 *
 * @returns {Promise<string>} The result (drift: extra Promise wrapper).
 */
export function incorrectPromiseDocs(): string {
  return 'value';
}

/**
 * Returns void.
 *
 * @returns {undefined} Should match because void ~ undefined.
 */
export function voidMatch(): void {
  return;
}

/**
 * Returns string.
 *
 * @returns {void} Drift: documents void but returns string.
 */
export function voidMismatch(): string {
  return 'value';
}

/**
 * Example function with a constrained generic to showcase @template drift.
 *
 * @template T - Template parameter documented without constraint to trigger drift.
 */
export function genericConstraintDrift<T extends string>(value: T): T {
  return value;
}
