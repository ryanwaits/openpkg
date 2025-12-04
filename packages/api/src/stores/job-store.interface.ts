import type { ScanJob, ScanResult } from '../scan-worker';

/**
 * Interface for scan job storage
 * Allows swapping in-memory store for Redis/KV in production
 */
export interface JobStore {
  /** Get a job by ID */
  get(jobId: string): ScanJob | undefined | Promise<ScanJob | undefined>;

  /** Set/update a job */
  set(jobId: string, job: ScanJob): void | Promise<void>;

  /** Get cached scan result */
  getFromCache(key: string): ScanResult | undefined | Promise<ScanResult | undefined>;

  /** Cache a scan result */
  setCache(key: string, result: ScanResult): void | Promise<void>;

  /** Cleanup expired entries */
  cleanup(): void | Promise<void>;

  /** Get store statistics */
  stats(): { jobs: number; cache: number } | Promise<{ jobs: number; cache: number }>;
}
