/**
 * Scan job store and caching layer
 */

import type { ScanResult } from '@doccov/sdk';
import type { JobStore } from './stores/job-store.interface';

// Re-export ScanResult for backwards compatibility
export type { ScanResult } from '@doccov/sdk';

export interface ScanJob {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  url: string;
  ref?: string;
  package?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: ScanResult;
  error?: string;
}

interface CacheEntry {
  result: ScanResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory job store with caching
 * Implements JobStore interface for easy swap to Redis/KV
 */
class ScanJobStore implements JobStore {
  private jobs = new Map<string, ScanJob>();
  private cache = new Map<string, CacheEntry>();

  /**
   * Get a job by ID
   */
  get(jobId: string): ScanJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Set/update a job
   */
  set(jobId: string, job: ScanJob): void {
    this.jobs.set(jobId, job);
  }

  /**
   * Get cached result
   */
  getFromCache(key: string): ScanResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Set cache entry
   */
  setCache(key: string, result: ScanResult): void {
    this.cache.set(key, {
      result,
      cachedAt: Date.now(),
    });
  }

  /**
   * Clean up old jobs and cache entries
   */
  cleanup(): void {
    const now = Date.now();

    // Clean old jobs
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > JOB_TTL_MS) {
        this.jobs.delete(id);
      }
    }

    // Clean expired cache
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get store stats for monitoring
   */
  stats(): { jobs: number; cache: number } {
    return {
      jobs: this.jobs.size,
      cache: this.cache.size,
    };
  }
}

// Singleton instance
export const scanJobStore = new ScanJobStore();

// Periodic cleanup every 5 minutes
// Use .unref() to prevent keeping the process alive
setInterval(
  () => {
    scanJobStore.cleanup();
  },
  5 * 60 * 1000,
).unref();
