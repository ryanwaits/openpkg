/**
 * Parameter name mismatch: docs say `tax`, signature says `taxRate`.
 *
 * @param base - Base price before tax.
 * @param tax - Intended to represent the tax percentage, but this param no longer exists.
 * @returns Total price including tax.
 */
export function applyTax(base: number, taxRate: number): number {
  return base + base * taxRate;
}

/**
 * Multiple parameter mismatches with fuzzy rename suggestions.
 *
 * @param firstName - User's first name.
 * @param lastName - User's last name.
 */
export function formatUser(name: string): string {
  return `User: ${name}`;
}

