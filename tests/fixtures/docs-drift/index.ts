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

/**
 * Announces a message.
 *
 * JSDoc says the parameter is optional, but the signature requires it.
 *
 * @param [message] - Optional announcement text (docs drift).
 */
export function announce(message: string): string {
  return `Announcement: ${message}`;
}

/**
 * Logs a metric with an optional label.
 *
 * The signature makes the label optional, but the docs claim it is required.
 *
 * @param label - Required label (docs drift).
 */
export function logMetric(label?: string): string {
  return label ? `Metric: ${label}` : 'Metric: <none>';
}

/**
 * The following double-doc pattern leaves a @deprecated tag on the symbol while
 * keeping the user-facing docs free of the tag. This ensures we can detect code
 * flagged as deprecated without a corresponding doc tag.
 */
/** @deprecated Use `reportHealth` instead. */
/**
 * Reports system health without surfacing the deprecation notice in docs.
 */
export function legacyHealthReport(): string {
  return 'ok';
}
