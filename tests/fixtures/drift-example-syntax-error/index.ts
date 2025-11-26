/**
 * Example syntax error: missing closing brace.
 *
 * @example
 * ```ts
 * const config = { name: 'test'
 * processConfig(config);
 * ```
 */
export function processConfig(config: { name: string }): void {
  console.log(config.name);
}

/**
 * Example syntax error: unclosed parenthesis.
 *
 * @example
 * ```ts
 * const result = calculateSum(1, 2, 3;
 * console.log(result);
 * ```
 */
export function calculateSum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

/**
 * Control case: valid example syntax.
 *
 * @example
 * ```ts
 * const greeting = formatGreeting('World');
 * console.log(greeting);
 * ```
 */
export function formatGreeting(name: string): string {
  return `Hello, ${name}!`;
}
