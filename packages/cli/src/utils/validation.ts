/**
 * Shared validation utilities for check and diff commands
 */

/**
 * Clamp a coverage/percentage value to 0-100 range
 * @param value - The value to clamp
 * @param fallback - Fallback value if NaN (default: 80)
 * @returns Clamped value between 0-100
 */
export function clampPercentage(value: number, fallback = 80): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Resolve threshold from CLI option or config
 * CLI flags take precedence over config values
 *
 * @param cliValue - Value from CLI flag (string or number)
 * @param configValue - Value from config file
 * @returns Resolved threshold or undefined if not set
 */
export function resolveThreshold(
  cliValue: string | number | undefined,
  configValue: number | undefined,
): number | undefined {
  const raw = cliValue ?? configValue;
  return raw !== undefined ? clampPercentage(Number(raw)) : undefined;
}
