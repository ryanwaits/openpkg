// shared/utils.ts - File outside the main directory (for testing ../ imports)
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
