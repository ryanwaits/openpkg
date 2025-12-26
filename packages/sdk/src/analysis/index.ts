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

// Drift detection and categorization
export {
  buildExportRegistry,
  calculateAggregateCoverage,
  type CategorizedDrift,
  categorizeDrift,
  computeDrift,
  computeExportDrift,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  type DriftResult,
  type DriftSummary,
  ensureSpecCoverage,
  type ExportDriftResult,
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
  enrichSpec,
  type EnrichOptions,
} from './enrich';

// Enriched diff (doccov-specific coverage tracking)
export {
  diffEnrichedSpec,
  type EnrichedSpecDiff,
} from './diff-enriched';

// History and trends
export {
  computeSnapshot,
  type CoverageSnapshot,
  type CoverageTrend,
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
  renderSparkline,
  RETENTION_DAYS,
  type RetentionTier,
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
