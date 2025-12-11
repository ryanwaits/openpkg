import type { SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import { getDefaultConfig, getRulesForKind } from './rules';
import type {
  AggregateQualityResult,
  QualityConfig,
  QualityResult,
  QualityViolation,
  RuleContext,
} from './types';

/**
 * Evaluate quality for a single export.
 *
 * @param exp - The export to evaluate
 * @param rawJSDoc - Optional raw JSDoc text for regex-based checks
 * @param config - Quality configuration with rule severities
 * @returns Quality result with coverage score and violations
 */
export function evaluateExportQuality(
  exp: SpecExport,
  rawJSDoc?: string,
  config: QualityConfig = { rules: {} },
): QualityResult {
  const kind = (exp.kind ?? 'variable') as SpecExportKind;
  const applicableRules = getRulesForKind(kind);
  const defaults = getDefaultConfig();

  // Helper to get effective severity
  const getSeverity = (ruleId: string, defaultSev: string) =>
    config.rules[ruleId] ?? defaults[ruleId] ?? defaultSev;

  // Only count coverage rules that are NOT 'off'
  const activeCoverageRules = applicableRules.filter((r) => {
    if (!r.affectsCoverage) return false;
    const severity = getSeverity(r.id, r.defaultSeverity);
    return severity !== 'off';
  });

  const result: QualityResult = {
    coverageScore: 0,
    coverage: {
      satisfied: [],
      missing: [],
      applicable: activeCoverageRules.map((r) => r.id),
    },
    violations: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      fixableCount: 0,
    },
  };

  const context: RuleContext = { export: exp, rawJSDoc };

  for (const rule of applicableRules) {
    const passed = rule.check(context);
    const severity = getSeverity(rule.id, rule.defaultSeverity);

    // Track coverage (only for active coverage rules - not 'off')
    if (rule.affectsCoverage && severity !== 'off') {
      if (passed) {
        result.coverage.satisfied.push(rule.id);
      } else {
        result.coverage.missing.push(rule.id);
      }
    }

    // Track violations (only if severity is not 'off')
    if (!passed && severity !== 'off' && rule.getViolation) {
      const violation: QualityViolation = {
        ...rule.getViolation(context),
        severity: severity === 'error' ? 'error' : 'warn',
      };
      result.violations.push(violation);

      if (violation.severity === 'error') {
        result.summary.errorCount++;
      } else {
        result.summary.warningCount++;
      }
      if (violation.fixable) {
        result.summary.fixableCount++;
      }
    }
  }

  // Calculate coverage score
  const { satisfied, applicable } = result.coverage;
  result.coverageScore =
    applicable.length === 0 ? 100 : Math.round((satisfied.length / applicable.length) * 100);

  return result;
}

/**
 * Evaluate quality for multiple exports.
 *
 * @param exports - Array of exports with optional raw JSDoc
 * @param config - Quality configuration with rule severities
 * @returns Aggregate result with per-export and overall scores
 */
export function evaluateQuality(
  exports: Array<{ export: SpecExport; rawJSDoc?: string }>,
  config: QualityConfig = { rules: {} },
): AggregateQualityResult {
  const byExport = new Map<string, QualityResult>();
  let totalCoverage = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const { export: exp, rawJSDoc } of exports) {
    const result = evaluateExportQuality(exp, rawJSDoc, config);
    byExport.set(exp.id ?? exp.name, result);

    totalCoverage += result.coverageScore;
    totalErrors += result.summary.errorCount;
    totalWarnings += result.summary.warningCount;
  }

  const count = exports.length;
  return {
    byExport,
    overall: {
      coverageScore: count === 0 ? 100 : Math.round(totalCoverage / count),
      totalViolations: totalErrors + totalWarnings,
      errorCount: totalErrors,
      warningCount: totalWarnings,
    },
  };
}

/**
 * Merge user configuration with defaults.
 *
 * @param userConfig - Partial user configuration
 * @returns Complete configuration with defaults filled in
 */
export function mergeConfig(userConfig: Partial<QualityConfig>): QualityConfig {
  const defaults = getDefaultConfig();
  return {
    rules: {
      ...defaults,
      ...userConfig.rules,
    },
  };
}

// Re-export for convenience
export {
  BUILTIN_RULES,
  getCoverageRules,
  getDefaultConfig,
  getRule,
  getRulesForKind,
} from './rules';
