import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Compute a hash of file contents.
 * Uses truncated SHA-256 for balance of speed and collision resistance.
 *
 * @param filePath - Absolute path to the file
 * @returns 16-character hex hash, or null if file doesn't exist
 */
export function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

/**
 * Hash a string value.
 *
 * @param content - String to hash
 * @returns 16-character hex hash
 */
export function hashString(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Hash multiple files and return a map of relative paths to hashes.
 *
 * @param filePaths - Array of absolute file paths
 * @param cwd - Base directory for relative path calculation
 * @returns Map of relative paths to their content hashes
 */
export function hashFiles(filePaths: string[], cwd: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const filePath of filePaths) {
    const hash = hashFile(filePath);
    if (hash) {
      // Store with relative path for portability
      const relativePath = path.relative(cwd, filePath);
      hashes[relativePath] = hash;
    }
  }
  return hashes;
}

/**
 * Compare two hash maps and return changed files.
 *
 * @param cached - Hash map from cache
 * @param current - Current hash map
 * @returns Array of file paths that changed, were added, or were removed
 */
export function diffHashes(
  cached: Record<string, string>,
  current: Record<string, string>,
): string[] {
  const changed: string[] = [];

  // Check for modified or deleted files
  for (const [file, hash] of Object.entries(cached)) {
    if (current[file] !== hash) {
      changed.push(file);
    }
  }

  // Check for new files
  for (const file of Object.keys(current)) {
    if (!(file in cached)) {
      changed.push(file);
    }
  }

  return changed;
}
