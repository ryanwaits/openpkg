/**
 * Visibility drift: marked @internal but exported publicly.
 *
 * @internal
 */
export function internalHelper(): void {
  // Should not be in public API
}

/**
 * Visibility drift: marked @public but is actually private implementation.
 *
 * @public
 */
function privateImpl(): void {
  // Not exported, but docs say @public
}

/**
 * Control case: correctly marked as public.
 *
 * @public
 */
export function publicApi(): string {
  return 'public';
}

/**
 * Class with visibility drift on members.
 */
export class Service {
  /**
   * Marked @internal but is a public method.
   * @internal
   */
  public doWork(): void {}

  /**
   * Correctly documented protected method.
   * @protected
   */
  protected helperMethod(): void {}
}

// Export privateImpl indirectly to use it (avoids unused warning)
export const _private = { impl: privateImpl };
