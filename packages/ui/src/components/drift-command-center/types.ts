// Drift Command Center Types

export type DriftSeverity = 'high' | 'medium' | 'low';
export type DriftStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'skipped';

export type DriftType =
  | 'example-runtime-error'
  | 'example-assertion-failed'
  | 'return-type-mismatch'
  | 'param-mismatch'
  | 'param-type-mismatch'
  | 'optionality-mismatch'
  | 'deprecated-mismatch'
  | 'visibility-mismatch'
  | 'broken-link'
  | 'async-mismatch'
  | 'generic-mismatch'
  | 'throws-mismatch'
  | 'example-drift'
  | 'missing-param';

// Severity classification as specified
export const DRIFT_SEVERITY_MAP: Record<DriftType, DriftSeverity> = {
  'example-runtime-error': 'high',
  'example-assertion-failed': 'high',
  'return-type-mismatch': 'high',
  'param-mismatch': 'medium',
  'param-type-mismatch': 'medium',
  'optionality-mismatch': 'medium',
  'deprecated-mismatch': 'medium',
  'visibility-mismatch': 'low',
  'broken-link': 'low',
  'async-mismatch': 'low',
  'generic-mismatch': 'medium',
  'throws-mismatch': 'medium',
  'example-drift': 'medium',
  'missing-param': 'medium',
};

export interface DriftIssue {
  id: string;
  type: DriftType;
  severity: DriftSeverity;
  description: string;
  filePath: string;
  line: number;
  column?: number;
  exportName?: string;
  isAutoFixable: boolean;
  suggestedFix?: {
    before: string;
    after: string;
  };
  status: DriftStatus;
}

export interface DriftStats {
  total: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<DriftType, number>;
  autoFixable: number;
}

export interface DriftFilterState {
  severity: DriftSeverity[];
  types: DriftType[];
  fixable: 'all' | 'auto-fixable' | 'manual';
  file: string;
  search: string;
}

export interface DriftCommandCenterProps {
  issues: DriftIssue[];
  packageName: string;
  onViewIssue?: (issue: DriftIssue) => void;
  onFixIssue?: (issue: DriftIssue) => void;
  onIgnoreIssue?: (issue: DriftIssue) => void;
  onFixAllAutoFixable?: () => void;
  className?: string;
}

// Helper to compute stats from issues
export function computeDriftStats(issues: DriftIssue[]): DriftStats {
  const stats: DriftStats = {
    total: issues.length,
    bySeverity: { high: 0, medium: 0, low: 0 },
    byType: {} as Record<DriftType, number>,
    autoFixable: 0,
  };

  for (const issue of issues) {
    stats.bySeverity[issue.severity]++;
    stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
    if (issue.isAutoFixable) stats.autoFixable++;
  }

  return stats;
}

// Human-readable labels
export const DRIFT_TYPE_LABELS: Record<DriftType, string> = {
  'example-runtime-error': 'Example Runtime Error',
  'example-assertion-failed': 'Example Assertion Failed',
  'return-type-mismatch': 'Return Type Mismatch',
  'param-mismatch': 'Parameter Mismatch',
  'param-type-mismatch': 'Parameter Type Mismatch',
  'optionality-mismatch': 'Optionality Mismatch',
  'deprecated-mismatch': 'Deprecated Mismatch',
  'visibility-mismatch': 'Visibility Mismatch',
  'broken-link': 'Broken Link',
  'async-mismatch': 'Async Mismatch',
  'generic-mismatch': 'Generic Mismatch',
  'throws-mismatch': 'Throws Mismatch',
  'example-drift': 'Example Drift',
  'missing-param': 'Missing Parameter',
};
