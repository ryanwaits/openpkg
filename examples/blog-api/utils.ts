/**
 * Generates a unique ID using random alphanumeric characters
 * @returns A 9-character unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Formats a date to ISO string format
 * @param date - The date to format
 * @returns ISO formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Validates an email address
 * @param email - The email to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Truncates text to a maximum length
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
