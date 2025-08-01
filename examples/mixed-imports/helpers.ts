// helpers.ts - Namespace import target
export function roundToDecimals(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}