/**
 * Scan module - types and utilities for documentation coverage scanning.
 */

export type { ScanContext, ScanOrchestratorOptions } from './orchestrator';
export { MonorepoRequiresPackageError, ScanOrchestrator } from './orchestrator';
export type { SpecSummary } from './summary';
export { extractSpecSummary } from './summary';
export type {
  DriftIssue,
  ProgressCallback,
  ProgressEvent,
  ProgressStage,
  ScanOptions,
  ScanResult,
} from './types';
