/**
 * Applies a tax to the base amount.
 *
 * @param base - Base price before tax.
 * @param tax - Intended to represent the tax percentage, but this param no longer exists.
 * @returns Total price including tax.
 */
export function applyTax(base: number, taxRate: number): number {
  return base + base * taxRate;
}

/**
 * Creates a user label.
 *
 * @param firstName - User's first name.
 * @param lastName - User's last name.
 */
export function formatUser(name: string): string {
  return `User: ${name}`;
}
