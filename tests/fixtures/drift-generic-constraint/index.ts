/**
 * Generic constraint drift: docs say `T extends string`, signature says `T extends object`.
 *
 * @template T extends string - Should be a string type.
 * @param value - The value to wrap.
 */
export function wrap<T extends object>(value: T): { wrapped: T } {
  return { wrapped: value };
}

/**
 * Generic constraint drift: docs omit constraint that exists in signature.
 *
 * @template T - Any type (but signature constrains to number).
 * @param items - Array of items.
 */
export function sumItems<T extends number>(items: T[]): number {
  return items.reduce((a, b) => a + b, 0);
}

/**
 * Control case: correctly documented generic constraint.
 *
 * @template T extends object - Must be an object type.
 * @param obj - Object to clone.
 */
export function clone<T extends object>(obj: T): T {
  return { ...obj };
}

