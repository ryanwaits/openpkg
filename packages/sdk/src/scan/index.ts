/**
 * Scan module - types and utilities for documentation coverage scanning.
 */

export type {
  DriftIssue,
  ProgressCallback,
  ProgressEvent,
  ProgressStage,
  ScanOptions,
  ScanResult,
} from './types';

export type { SpecSummary } from './summary';
export { extractSpecSummary } from './summary';

export type { ScanContext, ScanOrchestratorOptions } from './orchestrator';
export { MonorepoRequiresPackageError, ScanOrchestrator } from './orchestrator';

