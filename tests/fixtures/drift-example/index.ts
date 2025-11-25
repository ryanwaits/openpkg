/**
 * Example drift: references a type that doesn't exist (typo).
 *
 * @example
 * ```ts
 * import { calculateDiscount, PriceConfg } from './index';
 * const config: PriceConfg = { rate: 0.1 };
 * ```
 */
export function calculateDiscount(price: number): number {
  return price * 0.9;
}

/** Actual type - "PriceConfg" in example is a typo of this */
export interface PriceConfig {
  rate: number;
}

/**
 * Example drift: references a renamed/removed function.
 *
 * @example
 * ```ts
 * import { applyDiscount, oldHelperFunction } from './index';
 * oldHelperFunction(); // This function was removed
 * applyDiscount(100);
 * ```
 */
export function applyDiscount(amount: number): number {
  return amount * 0.85;
}

/**
 * Control case: example with valid references.
 *
 * @example
 * ```ts
 * import { formatPrice, PriceConfig } from './index';
 * const result = formatPrice(19.99);
 * ```
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

