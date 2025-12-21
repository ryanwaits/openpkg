// Coverage snapshot data point for charts
export interface CoverageDataPoint {
  version: string;
  date: string;
  coveragePercent: number;
  documentedCount: number;
  totalCount: number;
  driftCount: number;
  // Signal breakdown (optional)
  descriptionPercent?: number;
  paramsPercent?: number;
  returnsPercent?: number;
  examplesPercent?: number;
}

// Time range options
export type TimeRange = '7d' | '30d' | '90d' | 'all' | 'versions';

// Trend direction
export type TrendDirection = 'up' | 'down' | 'stable';

// Insight type
export interface CoverageInsight {
  type: 'improvement' | 'regression' | 'prediction' | 'milestone';
  message: string;
  severity?: 'info' | 'warning' | 'success';
}

// Regression alert
export interface RegressionInfo {
  fromVersion: string;
  toVersion: string;
  coverageDrop: number;
  exportsLost: number;
}
