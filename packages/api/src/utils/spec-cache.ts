/**
 * In-memory LRU cache for specs and diffs.
 * TTL: 1 hour, Max entries: 100 per cache
 */

import type { SpecDiffWithDocs } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 100;

// Spec cache: key = `${owner}/${repo}/${sha}`
const specCache = new Map<string, CacheEntry<OpenPkg>>();

// Diff cache: key = `${baseSha}_${headSha}`
const diffCache = new Map<string, CacheEntry<SpecDiffWithDocs>>();

/**
 * Evict oldest entries if cache exceeds max size
 */
function evictOldest<T>(cache: Map<string, CacheEntry<T>>): void {
  if (cache.size <= MAX_ENTRIES) return;

  // Find and delete oldest entry
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

/**
 * Check if entry is still valid (not expired)
 */
function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.createdAt < CACHE_TTL_MS;
}

/**
 * Generate cache key for spec
 */
export function specCacheKey(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}/${sha}`;
}

/**
 * Generate cache key for diff
 */
export function diffCacheKey(baseSha: string, headSha: string): string {
  return `${baseSha}_${headSha}`;
}

/**
 * Get cached spec if available and not expired
 */
export function getCachedSpec(owner: string, repo: string, sha: string): OpenPkg | null {
  const key = specCacheKey(owner, repo, sha);
  const entry = specCache.get(key);

  if (!isValid(entry)) {
    if (entry) specCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Cache a spec
 */
export function setCachedSpec(owner: string, repo: string, sha: string, spec: OpenPkg): void {
  const key = specCacheKey(owner, repo, sha);
  specCache.set(key, { value: spec, createdAt: Date.now() });
  evictOldest(specCache);
}

/**
 * Get cached diff if available and not expired
 */
export function getCachedDiff(baseSha: string, headSha: string): SpecDiffWithDocs | null {
  const key = diffCacheKey(baseSha, headSha);
  const entry = diffCache.get(key);

  if (!isValid(entry)) {
    if (entry) diffCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Cache a diff result
 */
export function setCachedDiff(baseSha: string, headSha: string, diff: SpecDiffWithDocs): void {
  const key = diffCacheKey(baseSha, headSha);
  diffCache.set(key, { value: diff, createdAt: Date.now() });
  evictOldest(diffCache);
}

/**
 * Clear all caches (for testing)
 */
export function clearCaches(): void {
  specCache.clear();
  diffCache.clear();
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats(): { specCount: number; diffCount: number } {
  return {
    specCount: specCache.size,
    diffCount: diffCache.size,
  };
}
