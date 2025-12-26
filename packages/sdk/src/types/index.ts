/**
 * Type definitions for reports and filtering.
 *
 * @example
 * ```ts
 * import type { DocCovReport, FilterOptions } from '@doccov/sdk/types';
 * ```
 *
 * @module types
 */

// Report types
export {
  type CoverageSummary,
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_PATH,
  type DocCovReport,
  type DriftReport,
  type DriftReportSummary,
  type ExportCoverageData,
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './report';

// Filter types (re-export from filtering module)
export type { FilterOptions, ReleaseTag } from '../filtering/types';
export type { FilterSource, ResolvedFilters } from '../filtering/merge';
export { mergeFilters, parseListFlag } from '../filtering/merge';
