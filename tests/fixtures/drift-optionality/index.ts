/**
 * Docs say optional, signature requires it.
 *
 * @param [message] - Optional announcement text (docs drift).
 */
export function announce(message: string): string {
  return `Announcement: ${message}`;
}

/**
 * Docs say required, signature makes it optional.
 *
 * @param label - Required label (docs drift).
 */
export function logMetric(label?: string): string {
  return label ? `Metric: ${label}` : 'Metric: <none>';
}

/**
 * Control case: correctly documented optionality.
 *
 * @param [suffix] - Optional suffix to append.
 */
export function greet(suffix?: string): string {
  return suffix ? `Hello${suffix}` : 'Hello';
}

