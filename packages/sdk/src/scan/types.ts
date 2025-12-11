/**
 * Scan types for CLI, API, and SDK consumers.
 * Single source of truth for scan-related interfaces.
 */

/**
 * Result of scanning a repository for documentation coverage.
 * Used by CLI scan command, API endpoints, and SDK consumers.
 */
export interface ScanResult {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Git ref (branch/tag) that was scanned */
  ref: string;
  /** Package name if scanning a monorepo package */
  packageName?: string;
  /** Overall documentation coverage percentage (0-100) */
  coverage: number;
  /** Number of public exports analyzed */
  exportCount: number;
  /** Number of types analyzed */
  typeCount: number;
  /** Number of documentation drift issues found */
  driftCount: number;
  /** Names of exports missing documentation */
  undocumented: string[];
  /** Drift issues found during analysis */
  drift: DriftIssue[];
}

/**
 * A documentation drift issue.
 */
export interface DriftIssue {
  /** Name of the export with drift */
  export: string;
  /** Type of drift (e.g., 'param-mismatch', 'return-type') */
  type: string;
  /** Human-readable description of the issue */
  issue: string;
  /** Optional suggestion for fixing the issue */
  suggestion?: string;
}

/**
 * Options for running a scan.
 */
export interface ScanOptions {
  /** GitHub URL or owner/repo shorthand */
  url: string;
  /** Git ref (branch/tag) to scan */
  ref?: string;
  /** Target package name for monorepos */
  package?: string;
  /** Skip dependency installation */
  skipInstall?: boolean;
  /** Skip external type resolution */
  skipResolve?: boolean;
}

/**
 * Stages of the scan pipeline.
 */
export type ProgressStage =
  | 'cloning'
  | 'detecting'
  | 'installing'
  | 'building'
  | 'analyzing'
  | 'complete';

/**
 * Progress event emitted during scan operations.
 */
export interface ProgressEvent {
  /** Current stage of the scan */
  stage: ProgressStage;
  /** Human-readable message */
  message: string;
  /** Progress percentage (0-100), if known */
  progress?: number;
}

/**
 * Callback for receiving progress events.
 */
export type ProgressCallback = (event: ProgressEvent) => void;
