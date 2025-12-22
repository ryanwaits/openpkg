import type { SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import type { JSDocPatch } from '../fix/jsdoc-writer';

/**
 * Quality rule severity levels.
 */
export type QualitySeverity = 'error' | 'warn' | 'off';

/**
 * Context passed to quality rule checks.
 */
export interface RuleContext {
  export: SpecExport;
  rawJSDoc?: string;
  /**
   * Registry of all exported names/IDs for spec-level rules.
   * Used by rules like no-forgotten-export to check if referenced types are exported.
   */
  exportRegistry?: Set<string>;
}

/**
 * A violation reported by a quality rule.
 */
export interface QualityViolation {
  ruleId: string;
  severity: 'error' | 'warn';
  message: string;
  line?: number;
  fixable: boolean;
}

/**
 * A quality rule checks one aspect of documentation quality.
 * Rules can contribute to coverage score, lint violations, or both.
 */
export interface QualityRule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** What this rule checks */
  description: string;

  /**
   * Which export kinds this rule applies to.
   * If undefined, applies to all kinds.
   */
  appliesTo?: SpecExportKind[];

  /**
   * Does this rule contribute to coverage score?
   * If true, the rule is counted as a "signal" for coverage calculation.
   */
  affectsCoverage: boolean;

  /**
   * Default lint severity. Set to 'off' if rule is coverage-only.
   */
  defaultSeverity: QualitySeverity;

  /**
   * Check if the export satisfies this rule.
   * Returns true if satisfied, false if not.
   */
  check(ctx: RuleContext): boolean;

  /**
   * Get detailed violation info when check returns false.
   * Only called if check() returns false and severity !== 'off'.
   */
  getViolation?(ctx: RuleContext): QualityViolation;

  /**
   * Generate a fix for the violation.
   * Only called if check() returns false and fix is requested.
   */
  fix?(ctx: RuleContext): JSDocPatch | null;
}

/**
 * User configuration for quality rules.
 */
export interface QualityConfig {
  rules: Record<string, QualitySeverity>;
}

/**
 * Result of evaluating quality for a single export.
 */
export interface QualityResult {
  /** Coverage score (0-100) */
  coverageScore: number;

  /** Coverage details */
  coverage: {
    /** Rule IDs that passed */
    satisfied: string[];
    /** Rule IDs that failed */
    missing: string[];
    /** All applicable rule IDs */
    applicable: string[];
  };

  /** Lint violations (only for rules with severity !== 'off') */
  violations: QualityViolation[];

  /** Summary counts */
  summary: {
    errorCount: number;
    warningCount: number;
    fixableCount: number;
  };
}

/**
 * Aggregate result for multiple exports.
 */
export interface AggregateQualityResult {
  byExport: Map<string, QualityResult>;
  overall: {
    coverageScore: number;
    totalViolations: number;
    errorCount: number;
    warningCount: number;
  };
}
