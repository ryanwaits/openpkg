// shared/utils.ts - File outside the main directory (for testing ../ imports)
export class SharedUtil {
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
  
  static generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}