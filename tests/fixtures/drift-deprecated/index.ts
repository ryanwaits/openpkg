/**
 * Has @deprecated tag but function is not actually deprecated in signature.
 *
 * @deprecated Use `reportHealth` instead.
 */
export function legacyHealthReport(): string {
  return 'ok';
}

/**
 * Missing @deprecated tag but function should be deprecated.
 * (This would need TypeScript deprecated annotation to detect)
 */
/** @deprecated */
export function oldMethod(): void {
  // deprecated
}

/**
 * Control case: properly documented deprecated function.
 *
 * @deprecated This function is obsolete, use `newCalculate` instead.
 */
export function oldCalculate(x: number): number {
  return x;
}

/**
 * The replacement function (not deprecated).
 */
export function newCalculate(x: number): number {
  return x * 2;
}

