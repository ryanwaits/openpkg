'use client';

import {
  type CoverageDataPoint,
  type CoverageInsight,
  InsightsPanel,
  RegressionAlert,
  type RegressionInfo,
  type TimeRange,
  TimeRangeSelector,
  type TrendDirection,
  TrendIndicator,
} from '@doccov/ui/coverage-trends';
import { cn } from '@doccov/ui/lib/utils';
import { SegmentedTabs, type TabCell } from '@doccov/ui/tabs';
import * as React from 'react';
import { CoverageChart } from './coverage-chart';
import { SignalBreakdownChart } from './signal-breakdown-chart';

interface SignalDataPoint {
  version: string;
  date: string;
  descriptionPercent: number;
  paramsPercent: number;
  returnsPercent: number;
  examplesPercent: number;
}

interface CoverageTrendsProps {
  data: CoverageDataPoint[];
  signalData?: SignalDataPoint[];
  insights?: CoverageInsight[];
  regression?: RegressionInfo | null;
  className?: string;
}

export function CoverageTrends({
  data,
  signalData,
  insights = [],
  regression,
  className,
}: CoverageTrendsProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('versions');
  const [chartView, setChartView] = React.useState<'coverage' | 'signals'>('coverage');

  // Calculate trend from data
  const latestCoverage = data.length > 0 ? data[data.length - 1].coverageScore : 0;
  const previousCoverage = data.length > 1 ? data[data.length - 2].coverageScore : latestCoverage;
  const trendValue = Math.round((latestCoverage - previousCoverage) * 10) / 10;
  const trendDirection: TrendDirection = trendValue > 0 ? 'up' : trendValue < 0 ? 'down' : 'stable';

  const chartTabs: TabCell[] = [
    { id: 'coverage', type: 'text', label: 'Coverage' },
    ...(signalData ? [{ id: 'signals', type: 'text' as const, label: 'Signals' }] : []),
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">Coverage Trends</h3>
          {data.length > 1 && (
            <TrendIndicator value={Math.abs(trendValue)} direction={trendDirection} size="sm" />
          )}
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Regression alert */}
      {regression && <RegressionAlert regression={regression} />}

      {/* Chart view toggle */}
      {signalData && (
        <SegmentedTabs
          tabs={chartTabs}
          activeTab={chartView}
          onTabChange={(id) => setChartView(id as 'coverage' | 'signals')}
        />
      )}

      {/* Chart */}
      <div className="border border-border rounded-lg p-4 bg-card">
        {chartView === 'coverage' ? (
          <CoverageChart data={data} height={220} />
        ) : signalData ? (
          <SignalBreakdownChart data={signalData} height={220} />
        ) : null}
      </div>

      {/* Insights */}
      {insights.length > 0 && <InsightsPanel insights={insights} />}
    </div>
  );
}

// Re-export types for convenience
export type { CoverageDataPoint, SignalDataPoint, CoverageInsight, RegressionInfo, TimeRange };
