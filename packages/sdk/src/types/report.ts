import type { SpecDocSignal, SpecDocDrift } from '@openpkg-ts/spec';

/**
 * DocCov report schema version.
 */
export const REPORT_VERSION = '1.0.0';

/**
 * Default path for cached DocCov reports.
 */
export const DEFAULT_REPORT_PATH = '.doccov/report.json';

/**
 * Coverage summary for an entire package or project.
 */
export interface CoverageSummary {
  /**
   * Overall coverage score (0-100).
   */
  score: number;

  /**
   * Total number of exports analyzed.
   */
  totalExports: number;

  /**
   * Number of fully documented exports.
   */
  documentedExports: number;

  /**
   * Breakdown of missing documentation by signal type.
   */
  missingBySignal: Record<SpecDocSignal, number>;

  /**
   * Total number of drift issues detected.
   */
  driftCount: number;
}

/**
 * Coverage data for a single export.
 */
export interface ExportCoverageData {
  /**
   * Export name.
   */
  name: string;

  /**
   * Export kind (function, class, etc.).
   */
  kind: string;

  /**
   * Coverage score for this export (0-100).
   */
  coverageScore: number;

  /**
   * Missing documentation signals.
   */
  missing?: SpecDocSignal[];

  /**
   * Drift issues for this export.
   */
  drift?: SpecDocDrift[];
}

/**
 * DocCov report - a persistable coverage analysis result.
 *
 * This is the format saved to `.doccov/report.json` and returned
 * by the `check` command with `--format json`.
 */
export interface DocCovReport {
  /**
   * JSON Schema reference for validation.
   */
  $schema: string;

  /**
   * Report format version.
   */
  version: string;

  /**
   * ISO 8601 timestamp when report was generated.
   */
  generatedAt: string;

  /**
   * Package/project metadata.
   */
  spec: {
    name: string;
    version?: string;
  };

  /**
   * Aggregate coverage summary.
   */
  coverage: CoverageSummary;

  /**
   * Per-export coverage data, keyed by export ID.
   */
  exports: Record<string, ExportCoverageData>;
}
