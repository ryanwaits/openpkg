import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import {
  type CoverageSummary,
  DEFAULT_REPORT_PATH,
  type DocCovReport,
  type ExportCoverageData,
  REPORT_VERSION,
} from '../types/report';
import { getDriftSummary } from './docs-coverage';
import { type EnrichedOpenPkg, enrichSpec } from './enrich';

/**
 * Generate a DocCov report from an OpenPkg spec.
 *
 * @param spec - The pure OpenPkg spec to analyze
 * @returns A DocCov report with coverage analysis
 *
 * @example
 * ```ts
 * import { DocCov, generateReport } from '@doccov/sdk';
 *
 * const doccov = new DocCov();
 * const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
 * const report = generateReport(spec);
 *
 * console.log(`Coverage: ${report.coverage.score}%`);
 * ```
 */
export function generateReport(spec: OpenPkg): DocCovReport {
  const enriched = enrichSpec(spec);
  return generateReportFromEnriched(enriched);
}

/**
 * Generate a DocCov report from an already-enriched spec.
 *
 * Use this when you've already called enrichSpec() and want to avoid
 * recomputing coverage data.
 *
 * @param enriched - The enriched OpenPkg spec
 * @returns A DocCov report with coverage analysis
 */
export function generateReportFromEnriched(enriched: EnrichedOpenPkg): DocCovReport {
  // Build per-export coverage data
  const exportsData: Record<string, ExportCoverageData> = {};
  const missingByRule: Record<string, number> = {};

  let documentedExports = 0;
  let totalDrift = 0;

  for (const exp of enriched.exports) {
    const data: ExportCoverageData = {
      name: exp.name,
      kind: exp.kind,
      coverageScore: exp.docs?.coverageScore ?? 100,
    };

    if (exp.docs?.missing && exp.docs.missing.length > 0) {
      data.missing = exp.docs.missing;
      for (const ruleId of exp.docs.missing) {
        missingByRule[ruleId] = (missingByRule[ruleId] ?? 0) + 1;
      }
    } else {
      documentedExports++;
    }

    if (exp.docs?.drift && exp.docs.drift.length > 0) {
      data.drift = exp.docs.drift;
      totalDrift += exp.docs.drift.length;
    }

    exportsData[exp.id] = data;
  }

  // Compute drift summary with category breakdown
  const allDrifts = enriched.exports.flatMap((exp) => exp.docs?.drift ?? []);
  const driftSummary = allDrifts.length > 0 ? getDriftSummary(allDrifts) : undefined;

  const coverage: CoverageSummary = {
    score: enriched.docs?.coverageScore ?? 100,
    totalExports: enriched.exports.length,
    documentedExports,
    missingByRule,
    driftCount: totalDrift,
    driftSummary,
  };

  return {
    $schema: 'https://doccov.dev/schemas/v1.0.0/report.schema.json',
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    spec: {
      name: enriched.meta.name,
      version: enriched.meta.version,
    },
    coverage,
    exports: exportsData,
  };
}

/**
 * Load a cached DocCov report from disk.
 *
 * @param reportPath - Path to the report file (defaults to .doccov/report.json)
 * @returns The cached report, or null if not found
 */
export function loadCachedReport(reportPath: string = DEFAULT_REPORT_PATH): DocCovReport | null {
  try {
    const fullPath = path.resolve(reportPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as DocCovReport;
  } catch {
    return null;
  }
}

/**
 * Save a DocCov report to disk.
 *
 * @param report - The report to save
 * @param reportPath - Path to save the report (defaults to .doccov/report.json)
 */
export function saveReport(report: DocCovReport, reportPath: string = DEFAULT_REPORT_PATH): void {
  const fullPath = path.resolve(reportPath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, JSON.stringify(report, null, 2));
}

/**
 * Check if a cached report is still valid.
 *
 * A report is considered stale if:
 * - It doesn't exist
 * - The spec version has changed
 * - Source files have been modified since generation
 *
 * @param reportPath - Path to the report file
 * @param sourceFiles - Source files to check modification times against
 * @returns True if the cached report is still valid
 */
export function isCachedReportValid(
  reportPath: string = DEFAULT_REPORT_PATH,
  sourceFiles: string[] = [],
): boolean {
  const report = loadCachedReport(reportPath);
  if (!report) {
    return false;
  }

  // Check if any source files have been modified since report generation
  const reportTime = new Date(report.generatedAt).getTime();

  for (const file of sourceFiles) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > reportTime) {
        return false;
      }
    } catch {
      // File doesn't exist or can't be read - consider report invalid
      return false;
    }
  }

  return true;
}
