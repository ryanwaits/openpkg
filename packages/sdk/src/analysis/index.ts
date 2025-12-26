/**
 * Analysis utilities for drift detection, coverage, and reporting.
 *
 * @example
 * ```ts
 * import { computeDrift, enrichSpec, generateReport } from '@doccov/sdk/analysis';
 * ```
 *
 * @module analysis
 */

// Context types
export type { DetectedSchemaEntry } from './context';
// Enriched diff (doccov-specific coverage tracking)
export {
  diffEnrichedSpec,
  type EnrichedSpecDiff,
} from './diff-enriched';
// Drift detection and categorization
export {
  buildExportRegistry,
  type CategorizedDrift,
  calculateAggregateCoverage,
  categorizeDrift,
  computeDrift,
  computeExportDrift,
  type DriftResult,
  type DriftSummary,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  type ExportDriftResult,
  ensureSpecCoverage,
  formatDriftSummaryLine,
  getDriftSummary,
  groupDriftsByCategory,
  hasNonAssertionComments,
  parseAssertions,
} from './docs-coverage';
// Enrichment
export {
  type EnrichedDocsMetadata,
  type EnrichedExport,
  type EnrichedOpenPkg,
  type EnrichOptions,
  enrichSpec,
} from './enrich';

// History and trends
export {
  type CoverageSnapshot,
  type CoverageTrend,
  computeSnapshot,
  type ExtendedTrendAnalysis,
  formatDelta,
  generateWeeklySummaries,
  getExtendedTrend,
  getTrend,
  HISTORY_DIR,
  loadSnapshots,
  loadSnapshotsForDays,
  pruneByTier,
  pruneHistory,
  RETENTION_DAYS,
  type RetentionTier,
  renderSparkline,
  saveSnapshot,
  type WeeklySummary,
} from './history';

// Report generation
export {
  generateReport,
  generateReportFromEnriched,
  isCachedReportValid,
  loadCachedReport,
  renderApiSurface,
  saveReport,
} from './report';

// Schema detection
export {
  detectRuntimeSchemas,
  type SchemaDetectionContext,
  type SchemaDetectionResult,
} from './schema-detection';

// Spec types
export type { OpenPkgSpec } from './spec-types';
