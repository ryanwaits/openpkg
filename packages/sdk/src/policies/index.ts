/**
 * Policy evaluation engine for per-path coverage thresholds.
 */

import * as path from 'node:path';
import { minimatch } from 'minimatch';
import type { PolicyConfig } from '../config/types';
import type { EnrichedExport, EnrichedOpenPkg } from '../analysis/enrich';

/**
 * Result of evaluating a single policy.
 */
export interface PolicyResult {
  /** The policy that was evaluated */
  policy: PolicyConfig;
  /** Exports that matched this policy's path pattern */
  matchedExports: EnrichedExport[];
  /** Coverage score for matched exports (0-100) */
  coverageScore: number;
  /** Drift score for matched exports (0-100, percentage of exports with drift) */
  driftScore: number;
  /** Number of matched exports missing @example */
  missingExamples: number;
  /** Whether the policy passed all configured thresholds */
  passed: boolean;
  /** Specific failures for this policy */
  failures: PolicyFailure[];
}

/**
 * A specific policy failure.
 */
export interface PolicyFailure {
  type: 'coverage' | 'drift' | 'examples';
  message: string;
  actual: number;
  threshold: number;
}

/**
 * Result of evaluating all policies.
 */
export interface PolicyEvaluationResult {
  /** Results for each policy */
  results: PolicyResult[];
  /** Whether all policies passed */
  allPassed: boolean;
  /** Total number of policies */
  totalPolicies: number;
  /** Number of policies that passed */
  passedCount: number;
  /** Number of policies that failed */
  failedCount: number;
}

/**
 * Check if an export's file path matches a policy's glob pattern.
 */
function matchesPolicy(
  exp: EnrichedExport,
  policy: PolicyConfig,
  baseDir?: string,
): boolean {
  const filePath = exp.source?.file;
  if (!filePath) return false;

  // Convert to relative path if baseDir provided and path is absolute
  let normalizedPath = filePath;
  if (baseDir && path.isAbsolute(filePath)) {
    normalizedPath = path.relative(baseDir, filePath);
  }

  // Remove leading ./ if present
  normalizedPath = normalizedPath.replace(/^\.\//, '');

  return minimatch(normalizedPath, policy.path, { matchBase: true });
}

/**
 * Calculate coverage score for a set of exports.
 */
function calculateCoverage(exports: EnrichedExport[]): number {
  if (exports.length === 0) return 100;

  let documented = 0;
  for (const exp of exports) {
    // An export is documented if it has a description
    if (exp.description) {
      documented++;
    }
  }

  return Math.round((documented / exports.length) * 100);
}

/**
 * Calculate drift score for a set of exports.
 * Returns percentage of exports that have drift issues.
 */
function calculateDrift(exports: EnrichedExport[]): number {
  if (exports.length === 0) return 0;

  let withDrift = 0;
  for (const exp of exports) {
    if (exp.docs?.drift && exp.docs.drift.length > 0) {
      withDrift++;
    }
  }

  return Math.round((withDrift / exports.length) * 100);
}

/**
 * Count exports missing @example.
 */
function countMissingExamples(exports: EnrichedExport[]): number {
  let missing = 0;
  for (const exp of exports) {
    // Check if export has any examples
    const hasExample = exp.examples && exp.examples.length > 0;
    if (!hasExample) {
      missing++;
    }
  }
  return missing;
}

/**
 * Evaluate a single policy against a set of exports.
 */
export function evaluatePolicy(
  policy: PolicyConfig,
  allExports: EnrichedExport[],
  baseDir?: string,
): PolicyResult {
  // Find exports that match this policy's path pattern
  const matchedExports = allExports.filter((exp) => matchesPolicy(exp, policy, baseDir));

  // Calculate metrics for matched exports
  const coverageScore = calculateCoverage(matchedExports);
  const driftScore = calculateDrift(matchedExports);
  const missingExamples = countMissingExamples(matchedExports);

  // Check thresholds and collect failures
  const failures: PolicyFailure[] = [];

  if (policy.minCoverage !== undefined && coverageScore < policy.minCoverage) {
    failures.push({
      type: 'coverage',
      message: `Coverage ${coverageScore}% below minimum ${policy.minCoverage}%`,
      actual: coverageScore,
      threshold: policy.minCoverage,
    });
  }

  if (policy.maxDrift !== undefined && driftScore > policy.maxDrift) {
    failures.push({
      type: 'drift',
      message: `Drift ${driftScore}% exceeds maximum ${policy.maxDrift}%`,
      actual: driftScore,
      threshold: policy.maxDrift,
    });
  }

  if (policy.requireExamples && missingExamples > 0) {
    failures.push({
      type: 'examples',
      message: `${missingExamples} exports missing @example`,
      actual: missingExamples,
      threshold: 0,
    });
  }

  return {
    policy,
    matchedExports,
    coverageScore,
    driftScore,
    missingExamples,
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Options for evaluating policies.
 */
export interface EvaluatePoliciesOptions {
  /** Base directory for resolving relative paths in policies */
  baseDir?: string;
}

/**
 * Evaluate all policies against a spec's exports.
 */
export function evaluatePolicies(
  policies: PolicyConfig[],
  spec: EnrichedOpenPkg,
  options: EvaluatePoliciesOptions = {},
): PolicyEvaluationResult {
  const { baseDir } = options;
  const exports = spec.exports ?? [];
  const results = policies.map((policy) => evaluatePolicy(policy, exports, baseDir));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    results,
    allPassed: failedCount === 0,
    totalPolicies: policies.length,
    passedCount,
    failedCount,
  };
}

export type { PolicyConfig };
